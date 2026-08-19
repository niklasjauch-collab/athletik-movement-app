"use client";

// Coach-facing scan upload — posts straight to
// /api/clients/[id]/scans/route.ts, which does the ENTIRE analyze ->
// findings -> plan(s) pipeline automatically server-side (see that
// route's comment). This component's only job is the upload + showing
// the route's result message; it does not do any findings review or
// plan-generation step itself, unlike the older /scans demo page.
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function UploadForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    message?: string;
    plansGenerated: number;
    findingsCount?: number;
    summary?: string;
  } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setResult(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/clients/${clientId}/scans`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload fehlgeschlagen.");
        setUploading(false);
        return;
      }
      setResult(data);
      setFile(null);
      router.refresh();
    } catch {
      setError("Upload fehlgeschlagen. Bitte später erneut versuchen.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700">SmartMotionScan-Bericht (PDF)</label>
          <input
            type="file"
            accept="application/pdf,image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 w-full text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={!file || uploading}
          className="rounded-lg bg-ink-900 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {uploading ? "Wird analysiert…" : "Hochladen & Plan automatisch erstellen"}
        </button>
      </form>
      <p className="mt-2 text-xs text-slate-400">
        Nach dem Upload wird der Bericht automatisch ausgewertet und daraus sofort 1 (bei vielen Befunden 2)
        Corrective-Exercise-Plan(e) erstellt — ohne weitere Schritte.
      </p>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {result && (
        <div className="mt-3 rounded-lg bg-brand-50 p-3 text-sm text-brand-700">
          {result.plansGenerated > 0 ? (
            <p>
              ✓ {result.plansGenerated} Plan{result.plansGenerated > 1 ? "e" : ""} automatisch erstellt aus{" "}
              {result.findingsCount} Befund{result.findingsCount !== 1 ? "en" : ""}.
            </p>
          ) : (
            <p>{result.message}</p>
          )}
          {result.summary && <p className="mt-1 text-xs text-brand-600">{result.summary}</p>}
        </div>
      )}
    </div>
  );
}
