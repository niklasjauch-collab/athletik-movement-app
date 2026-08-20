"use client";

// CoachAdmin briefing §6: "Admin muss zukünftig weitere Segmente selbst
// erstellen können." System-default segments (the 6 from seed.ts) can be
// edited but not deleted — see the DELETE route's comment.
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

type Segment = { id: string; key: string; name: string; description: string | null; isSystemDefault: boolean };

export default function SegmentsManager({ segments }: { segments: Segment[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/segments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Segment konnte nicht erstellt werden.");
        return;
      }
      setName("");
      setDescription("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/segments/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      <ul className="flex flex-col gap-2">
        {segments.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-ink-900/10 p-3">
            <div>
              <p className="text-sm font-medium text-ink-900">
                {s.name}
                {s.isSystemDefault && <span className="ml-2 text-[10px] uppercase text-ink-700/40">Standard</span>}
              </p>
              {s.description && <p className="text-xs text-ink-700/50">{s.description}</p>}
            </div>
            {!s.isSystemDefault && (
              <button
                type="button"
                onClick={() => handleDelete(s.id)}
                className="text-xs text-red-600 hover:underline shrink-0"
              >
                Löschen
              </button>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={handleCreate} className="mt-4 flex flex-wrap gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Neues Segment, z. B. Sponsoren"
          className="flex-1 min-w-[180px] rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Beschreibung (optional)"
          className="flex-1 min-w-[180px] rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="rounded-lg bg-ink-900 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Anlegen
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
