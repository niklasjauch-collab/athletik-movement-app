"use client";

// CoachAdmin briefing §41 — internal coach notes, never customer-visible.
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

type Note = { id: string; text: string; pinned: boolean; createdAt: string; authorId: string | null };

export default function NotesPanel({ clientId, notes }: { clientId: string; notes: Note[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/customers/${clientId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Notiz konnte nicht gespeichert werden.");
        return;
      }
      setText("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function togglePin(noteId: string, pinned: boolean) {
    await fetch(`/api/admin/customers/${clientId}/notes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noteId, pinned: !pinned }),
    });
    router.refresh();
  }

  const sorted = [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Interne Notiz — für den Kunden nicht sichtbar…"
          className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving || !text.trim()}
            className="rounded-lg bg-ink-900 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50 self-start"
          >
            {saving ? "Speichert…" : "Notiz speichern"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </form>

      <ul className="mt-6 flex flex-col gap-3">
        {sorted.length === 0 && <li className="text-sm text-ink-700/50">Noch keine Notizen.</li>}
        {sorted.map((n) => (
          <li key={n.id} className="rounded-lg border border-ink-900/10 p-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-ink-900 whitespace-pre-wrap">{n.text}</p>
              <button
                type="button"
                onClick={() => togglePin(n.id, n.pinned)}
                className={`shrink-0 text-xs rounded-full px-2 py-0.5 ${n.pinned ? "bg-amber-100 text-amber-700" : "bg-ink-900/5 text-ink-700/50"}`}
              >
                {n.pinned ? "★ Angepinnt" : "☆ Anpinnen"}
              </button>
            </div>
            <p className="mt-1 text-xs text-ink-700/40">{new Date(n.createdAt).toLocaleString("de-DE")}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
