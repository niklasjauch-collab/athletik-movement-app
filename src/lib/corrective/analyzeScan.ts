// AI-assisted first pass at reading a SmartMotionScan (or other movement
// assessment) PDF/image report and proposing which standardized OHSA
// compensations it documents.
//
// Why this exists despite the earlier "we deliberately do NOT auto-parse"
// decision (see the MovementScan model comment in schema.prisma): that
// decision was about writing a *parser* against SmartMotionScan's
// proprietary export format, which isn't documented anywhere we could
// build a reliable parser against. Reading the PDF with a multimodal
// model sidesteps that problem entirely — it doesn't need to know the
// file format, it reads the report the same way a human would. What it
// produces is still a PROPOSAL, never the final findings: the /scans page
// pre-fills the same findings checklist a coach fills in by hand, clearly
// marked as AI-suggested and fully editable, and nothing is used to
// generate a plan until the coach reviews and confirms it. This keeps the
// "record findings, then generate the program" workflow (and the human
// clinical judgment it depends on) fully intact — it just automates the
// tedious transcription step.
//
// Data-protection note: this sends a client's movement-assessment
// report — health data — to Anthropic's API. Before enabling this in
// production, make sure that's covered by an Auftragsverarbeitungsvertrag
// (AVV/DPA) with Anthropic and by the client's informed consent (see the
// concept doc's DSGVO/Gesundheitsdaten section). That's why this is
// wired as an explicit, opt-in "PDF automatisch analysieren" button in
// the UI rather than something that runs automatically on upload.

import Anthropic from "@anthropic-ai/sdk";
import { COMPENSATION_RULES, CompensationKey } from "./rules";
import type { Side } from "./generatePlan";
import type { Severity } from "./splitIntoSessions";

const COMPENSATION_KEYS = Object.keys(COMPENSATION_RULES) as CompensationKey[];
const SIDES: Side[] = ["LEFT", "RIGHT", "BILATERAL"];
const SEVERITIES: Severity[] = ["MILD", "MODERATE", "SEVERE"];

export interface AnalyzeScanFinding {
  compensation: CompensationKey;
  side: Side;
  confidence: "high" | "medium" | "low";
  /** How severe the source report rates this finding (e.g. SmartMotionScan's
   * own MILD/MÄSSIG/SCHWER dysbalance rating), when the report states one.
   * Drives splitIntoSessions.ts's priority ranking when a scan has enough
   * findings to need two plans. Omitted (not guessed) when the report
   * doesn't give a severity for a finding. */
  severity?: Severity;
  /** Short quote/paraphrase from the report the model based this on, shown
   * to the coach so the suggestion is auditable rather than a black box. */
  evidence?: string;
}

export interface AnalyzeScanResult {
  findings: AnalyzeScanFinding[];
  /** 1-3 sentence German summary of what the model read, for a quick
   * coach sanity-check independent of the structured findings. */
  summary: string;
  /** True when the model didn't think this was a readable movement
   * assessment report at all (wrong file, empty scan, unsupported
   * format) — the UI should show this instead of an empty findings list. */
  unreadable: boolean;
}

/** Thrown when ANTHROPIC_API_KEY (or ANTHROPIC_MODEL) isn't configured —
 * distinct from an analysis failure so the API route/UI can say "not set
 * up yet, enter findings manually" rather than "something went wrong". */
export class AnalyzeScanConfigError extends Error {}

const RECORD_FINDINGS_TOOL = {
  name: "record_findings",
  description:
    "Record which standardized Overhead Squat Assessment (OHSA) compensations this movement-assessment report documents.",
  input_schema: {
    type: "object" as const,
    properties: {
      unreadable: {
        type: "boolean",
        description:
          "true if this document is not a movement/posture assessment report, or its content could not be meaningfully read (e.g. blank, corrupted, wrong file).",
      },
      summary: {
        type: "string",
        description:
          "1-3 Sätze auf Deutsch: kurze Zusammenfassung dessen, was im Bericht zu Haltung/Bewegungskompensationen dokumentiert ist, damit ein Coach die Vorschläge schnell einordnen kann.",
      },
      findings: {
        type: "array",
        description:
          "Nur Kompensationen, die im Dokument tatsächlich als auffällig/dokumentiert erscheinen. Keine Kompensation raten oder ergänzen, die nicht im Bericht belegt ist.",
        items: {
          type: "object",
          properties: {
            compensation: { type: "string", enum: COMPENSATION_KEYS },
            side: {
              type: "string",
              enum: SIDES,
              description:
                "LEFT/RIGHT nur wenn der Bericht die Kompensation explizit einer Seite zuordnet; sonst BILATERAL.",
            },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
            severity: {
              type: "string",
              enum: SEVERITIES,
              description:
                "Nur setzen, wenn der Bericht selbst eine Schweregrad-Einstufung für diesen Befund nennt (z.B. MILD/MÄSSIG/SCHWER oder eine Winkelabweichung, die klar einer Stufe zuzuordnen ist). Sonst weglassen, nicht raten.",
            },
            evidence: {
              type: "string",
              description: "Kurzes Zitat oder Fundstelle aus dem Bericht, das diesen Befund stützt.",
            },
          },
          required: ["compensation", "side", "confidence"],
        },
      },
    },
    required: ["findings", "summary", "unreadable"],
  },
};

const SYSTEM_PROMPT = `Du unterstützt eine NASM-CES- und Brookbush-SmartMotionApproach-zertifizierte Trainer:in beim Auswerten eines SmartMotionScan-Bewegungsassessments (statische Haltungsanalyse + Overhead Squat / Single-Leg-Stance, Plattform "Moti Physio 2").

Lies den beigefügten Bericht und rufe ausschließlich das Tool "record_findings" auf. Melde nur Kompensationen, die im Bericht tatsächlich als auffällig dokumentiert sind — rate nichts hinzu. Wenn eine Kompensation im Bericht klar einer Körperseite zugeordnet ist (z.B. "rechtes Knie kippt nach innen"), setze side entsprechend; wenn keine Seite genannt ist oder beide Seiten betroffen sind, verwende BILATERAL. Setze severity nur, wenn der Bericht selbst eine Schweregrad-Einstufung angibt (z.B. MILD/MÄSSIG/SCHWER oder eine eindeutig zuordenbare Winkelabweichung) — sonst weglassen. Wenn das Dokument kein auswertbares Bewegungsassessment ist, setze unreadable=true und lasse findings leer.`;

function isValidFinding(f: unknown): f is AnalyzeScanFinding {
  if (!f || typeof f !== "object") return false;
  const obj = f as Record<string, unknown>;
  return (
    typeof obj.compensation === "string" &&
    COMPENSATION_KEYS.includes(obj.compensation as CompensationKey) &&
    typeof obj.side === "string" &&
    SIDES.includes(obj.side as Side) &&
    typeof obj.confidence === "string" &&
    ["high", "medium", "low"].includes(obj.confidence)
  );
}

export interface AnalyzeScanInput {
  /** Raw file bytes. */
  data: Buffer;
  /** e.g. "application/pdf", "image/jpeg", "image/png". */
  mediaType: string;
}

export async function analyzeScanDocument({ data, mediaType }: AnalyzeScanInput): Promise<AnalyzeScanResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL;
  if (!apiKey) {
    throw new AnalyzeScanConfigError(
      "ANTHROPIC_API_KEY ist nicht gesetzt — die automatische Analyse ist nicht konfiguriert. Befunde können weiterhin manuell erfasst werden."
    );
  }
  if (!model) {
    throw new AnalyzeScanConfigError(
      "ANTHROPIC_MODEL ist nicht gesetzt (siehe .env.example — aktuelle Modellnamen unter docs.claude.com/en/docs/about-claude/models nachsehen)."
    );
  }

  const isPdf = mediaType === "application/pdf";
  if (!isPdf && !mediaType.startsWith("image/")) {
    throw new Error(`Nicht unterstützter Dateityp für die Analyse: ${mediaType}`);
  }

  const client = new Anthropic({ apiKey });
  const base64 = data.toString("base64");

  const documentBlock = isPdf
    ? ({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: base64 },
      } as const)
    : ({
        type: "image",
        source: { type: "base64", media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: base64 },
      } as const);

  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    tools: [RECORD_FINDINGS_TOOL],
    tool_choice: { type: "tool", name: "record_findings" },
    messages: [
      {
        role: "user",
        content: [
          documentBlock,
          {
            type: "text",
            text: "Werte diesen Bewegungsassessment-Bericht aus und rufe record_findings auf.",
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === "record_findings"
  );
  if (!toolUse) {
    throw new Error("Die Analyse hat kein strukturiertes Ergebnis geliefert. Bitte Befunde manuell erfassen.");
  }

  const input = toolUse.input as {
    unreadable?: boolean;
    summary?: string;
    findings?: unknown[];
  };

  // Severity is optional and validated separately from isValidFinding's
  // required fields — an out-of-enum/hallucinated value is dropped rather
  // than rejecting the whole finding, since a finding with an unreadable
  // severity is still a valid finding.
  const findings = (input.findings ?? [])
    .filter(isValidFinding)
    .map((f) => ({
      ...f,
      severity: SEVERITIES.includes(f.severity as Severity) ? f.severity : undefined,
    }));

  return {
    unreadable: Boolean(input.unreadable),
    summary: input.summary ?? "",
    findings,
  };
}
