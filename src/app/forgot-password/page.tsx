"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Anfrage fehlgeschlagen.");
        setSubmitting(false);
        return;
      }
      setMessage(data.message);
      setDevResetUrl(data.devResetUrl ?? null);
    } catch {
      setError("Anfrage fehlgeschlagen. Bitte später erneut versuchen.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex-1 max-w-md mx-auto px-6 py-16">
      <h1 className="text-2xl font-extrabold text-center">Passwort vergessen</h1>
      <p className="mt-2 text-sm text-slate-500 text-center">
        Gib deine E-Mail-Adresse ein — wir schicken dir einen Link zum Zurücksetzen.
      </p>

      {message ? (
        <div className="mt-8 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-700">
          {message}
          {devResetUrl && (
            <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-700">
              <span className="font-semibold">Dev-Modus (kein E-Mail-Versand konfiguriert):</span>{" "}
              <Link href={devResetUrl} className="underline break-all">
                {devResetUrl}
              </Link>
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">E-Mail-Adresse</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              autoComplete="email"
              required
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-lg bg-ink-900 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {submitting ? "Wird gesendet…" : "Link senden"}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-slate-500">
        <Link href="/login" className="font-medium text-brand-700 underline">
          Zurück zum Login
        </Link>
      </p>
    </main>
  );
}
