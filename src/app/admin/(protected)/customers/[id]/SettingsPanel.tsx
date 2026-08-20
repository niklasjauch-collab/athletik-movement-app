"use client";

// CoachAdmin briefing §4/§5/§6/§10 Einstellungen tab: status, segments,
// legacy program, phone, archive — the "boring but load-bearing" customer
// fields. One panel, several small forms, each posts independently so a
// coach doesn't lose unrelated in-progress edits if one save fails.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Segment = { id: string; name: string; isSystemDefault: boolean };
type LegacyProgram = { id: string; name: string };

const STATUS_OPTIONS = [
  { value: "LEAD", label: "Lead" },
  { value: "ACTIVE", label: "Aktiv" },
  { value: "PAUSED", label: "Pausiert" },
  { value: "INACTIVE", label: "Inaktiv" },
  { value: "ARCHIVED", label: "Archiviert" },
];

export default function SettingsPanel({
  clientId,
  status,
  phone,
  archivedAt,
  allSegments,
  memberSegmentIds,
  legacyPrograms,
  legacyProgramId,
}: {
  clientId: string;
  status: string;
  phone: string | null;
  archivedAt: string | null;
  allSegments: Segment[];
  memberSegmentIds: string[];
  legacyPrograms: LegacyProgram[];
  legacyProgramId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [phoneValue, setPhoneValue] = useState(phone ?? "");

  async function patchClient(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await fetch(`/api/admin/customers/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggleSegment(segmentId: string, currentlyOn: boolean) {
    setBusy(true);
    try {
      await fetch(`/api/admin/customers/${clientId}/segments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segmentId, action: currentlyOn ? "unassign" : "assign" }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h3 className="text-sm font-semibold text-ink-900">Status</h3>
        <p className="text-xs text-ink-700/50">Status und Segment sind getrennte Dimensionen.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={busy}
              onClick={() => patchClient({ status: opt.value })}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                status === opt.value ? "bg-brand-600 text-white" : "bg-ink-900/5 text-ink-700 hover:bg-ink-900/10"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-ink-900">Segmente</h3>
        <p className="text-xs text-ink-700/50">Ein Kunde kann mehreren Segmenten angehören.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {allSegments.map((seg) => {
            const on = memberSegmentIds.includes(seg.id);
            return (
              <button
                key={seg.id}
                type="button"
                disabled={busy}
                onClick={() => toggleSegment(seg.id, on)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  on ? "bg-ink-900 text-white" : "bg-ink-900/5 text-ink-700 hover:bg-ink-900/10"
                }`}
              >
                {seg.name}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-ink-900">Legacy-Programm</h3>
        <p className="text-xs text-ink-700/50">
          Ordnet den Kunden einem Legacy-Programm zu (alte Preise/Links/Bedingungen). Legacy-Programme werden unter{" "}
          <Link href="/admin/customers/manage" className="underline">
            Segmente &amp; Legacy-Programme verwalten
          </Link>{" "}
          angelegt.
        </p>
        <select
          defaultValue={legacyProgramId ?? ""}
          disabled={busy}
          onChange={(e) => patchClient({ legacyProgramId: e.target.value || null })}
          className="mt-2 rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
        >
          <option value="">Kein Legacy-Programm</option>
          {legacyPrograms.map((lp) => (
            <option key={lp.id} value={lp.id}>
              {lp.name}
            </option>
          ))}
        </select>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-ink-900">Telefon</h3>
        <div className="mt-2 flex gap-2">
          <input
            type="tel"
            value={phoneValue}
            onChange={(e) => setPhoneValue(e.target.value)}
            className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
            placeholder="+49 …"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => patchClient({ phone: phoneValue || null })}
            className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm font-medium"
          >
            Speichern
          </button>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-ink-900">Account</h3>
        <p className="text-xs text-ink-700/50">
          Standardaktion ist Archivieren, nie ein endgültiges Löschen — archivierte Kunden bleiben in der Historie
          erhalten.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => patchClient({ archived: !archivedAt })}
          className="mt-2 rounded-lg border border-ink-900/15 px-4 py-2 text-sm font-medium hover:bg-ink-900/5"
        >
          {archivedAt ? "Archivierung aufheben" : "Kunde archivieren"}
        </button>
      </section>
    </div>
  );
}
