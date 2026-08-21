"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function CreateCustomerForm() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, phone: phone || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Kunde konnte nicht angelegt werden.");
        return;
      }
      router.push(`/admin/customers/${data.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleCreate} className="mt-6 max-w-sm flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-700/60">Vorname</label>
        <input
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
          className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-700/60">Nachname</label>
        <input
          type="text"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          required
          className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-700/60">E-Mail</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-700/60">Telefon (optional)</label>
        <input
          type="text"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={saving || !firstName.trim() || !lastName.trim() || !email.trim()}
        className="mt-2 rounded-lg bg-ink-900 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
      >
        Kunde anlegen
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-ink-700/40">
        Der Kunde erhält noch kein Passwort — Login funktioniert erst nach dem normalen
        Registrierungs-/Passwort-vergessen-Flow, wie bei jedem anderen manuell angelegten Kunden.
      </p>
    </form>
  );
}
