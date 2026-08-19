"use client";

import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function AdminResetPasswordPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <main className="flex-1 max-w-md mx-auto px-6 py-16 text-center">
        <h1 className="font-serif text-2xl font-bold text-ink-900">Ungültiger Link</h1>
        <p className="mt-2 text-sm text-ink-700/70">
          Dieser Link zum Setzen des Passworts ist unvollständig.{" "}
          <Link href="/admin/forgot-password" className="text-brand-700 underline">
            Neuen Link anfordern
          </Link>
          .
        </p>
      </main>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Das Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Zurücksetzen fehlgeschlagen.");
        setSubmitting(false);
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/admin/login"), 1800);
    } catch {
      setError("Zurücksetzen fehlgeschlagen. Bitte später erneut versuchen.");
      setSubmitting(false);
    }
  }

  return (
    <main className="flex-1 max-w-md mx-auto px-6 py-16">
      <h1 className="font-serif text-2xl font-bold text-ink-900 text-center">Passwort setzen</h1>

      {done ? (
        <p className="mt-8 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-700 text-center">
          Passwort erfolgreich gesetzt. Du wirst zum Login weitergeleitet…
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-ink-700">Neues Passwort</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-700">Passwort bestätigen</label>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-lg bg-ink-900 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {submitting ? "Wird gespeichert…" : "Passwort speichern"}
          </button>
        </form>
      )}
    </main>
  );
}

export default function AdminResetPasswordPage() {
  return (
    <Suspense fallback={<main className="flex-1 max-w-md mx-auto px-6 py-16 text-sm text-ink-700/60">Lädt…</main>}>
      <AdminResetPasswordPageInner />
    </Suspense>
  );
}
