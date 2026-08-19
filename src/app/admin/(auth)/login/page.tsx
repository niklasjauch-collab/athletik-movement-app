"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getBranding } from "@/lib/branding";

const branding = getBranding();

// Separate login from the customer /login — different cookie, different
// table (AdminUser, not Client), see src/lib/adminAuth.ts. No public
// self-registration here on purpose (single-operator business) — the
// first account is seeded and its password set via
// /admin/forgot-password, same as any later reset.
export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login fehlgeschlagen.");
        setSubmitting(false);
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Login fehlgeschlagen. Bitte später erneut versuchen.");
      setSubmitting(false);
    }
  }

  return (
    <main className="flex-1 max-w-md mx-auto px-6 py-16">
      <div className="flex flex-col items-center text-center">
        {branding.iconUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={branding.iconUrl} alt={branding.appName} className="h-16 w-auto" />
        )}
        <h1 className="mt-4 font-serif text-2xl font-bold text-ink-900">Coach-Bereich</h1>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-ink-700">E-Mail-Adresse</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
            autoComplete="email"
            required
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-ink-700">Passwort</label>
            <Link href="/admin/forgot-password" className="text-xs text-brand-700 underline">
              Passwort vergessen?
            </Link>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
            autoComplete="current-password"
            required
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded-lg bg-ink-900 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {submitting ? "Wird geprüft…" : "Einloggen"}
        </button>
      </form>
    </main>
  );
}
