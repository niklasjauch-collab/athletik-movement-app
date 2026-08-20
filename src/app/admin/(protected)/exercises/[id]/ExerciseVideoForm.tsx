"use client";

// CoachAdmin briefing §38 VIDEO MANAGEMENT: upload/ersetzen (as a URL —
// see the API route's comment for why), Thumbnail ändern, Vorschau
// ansehen, plus the isPublished toggle (a plan can't be published while
// referencing an unpublished exercise's content in the client-facing
// library — that gate lives on the plan side; this is just the exercise's
// own visibility switch).
import { useState } from "react";
import { useRouter } from "next/navigation";

function VideoPreview({ url, label }: { url: string; label: string }) {
  const looksLikeFile = /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);
  return (
    <div className="mt-2">
      {looksLikeFile ? (
        <video controls src={url} className="w-full max-w-xs rounded-lg border border-ink-900/10" />
      ) : (
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-700 underline">
          {label} öffnen ↗
        </a>
      )}
    </div>
  );
}

export default function ExerciseVideoForm({
  exerciseId,
  initial,
}: {
  exerciseId: string;
  initial: { videoMaleUrl: string | null; videoFemaleUrl: string | null; videoThumbnailUrl: string | null; isPublished: boolean };
}) {
  const router = useRouter();
  const [videoMaleUrl, setVideoMaleUrl] = useState(initial.videoMaleUrl ?? "");
  const [videoFemaleUrl, setVideoFemaleUrl] = useState(initial.videoFemaleUrl ?? "");
  const [videoThumbnailUrl, setVideoThumbnailUrl] = useState(initial.videoThumbnailUrl ?? "");
  const [isPublished, setIsPublished] = useState(initial.isPublished);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/exercises/${exerciseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoMaleUrl: videoMaleUrl || null,
          videoFemaleUrl: videoFemaleUrl || null,
          videoThumbnailUrl: videoThumbnailUrl || null,
          isPublished,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      setSaved(true);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-ink-700/50">
        Kein Datei-Upload in dieser Umgebung (kein Objekt-Speicher konfiguriert) — stattdessen die Wiedergabe-URL
        eintragen, wo das Video tatsächlich gehostet ist.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-700/60">Video (männlich) — URL</label>
          <input
            value={videoMaleUrl}
            onChange={(e) => setVideoMaleUrl(e.target.value)}
            placeholder="https://…"
            className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
          />
          {videoMaleUrl && <VideoPreview url={videoMaleUrl} label="Video (männlich)" />}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-700/60">Video (weiblich) — URL</label>
          <input
            value={videoFemaleUrl}
            onChange={(e) => setVideoFemaleUrl(e.target.value)}
            placeholder="https://…"
            className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
          />
          {videoFemaleUrl && <VideoPreview url={videoFemaleUrl} label="Video (weiblich)" />}
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="text-xs text-ink-700/60">Thumbnail — URL</label>
          <input
            value={videoThumbnailUrl}
            onChange={(e) => setVideoThumbnailUrl(e.target.value)}
            placeholder="https://…"
            className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
          />
          {videoThumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- external, arbitrary host URL, not a local/optimizable asset
            <img src={videoThumbnailUrl} alt="Thumbnail-Vorschau" className="mt-2 h-24 w-24 rounded-lg object-cover border border-ink-900/10" />
          )}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink-900">
        <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
        Veröffentlicht (in der Kunden-Bibliothek sichtbar)
      </label>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-ink-900 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {saving ? "Speichert…" : "Speichern"}
        </button>
        {saved && <span className="text-sm text-brand-700">Gespeichert.</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}
