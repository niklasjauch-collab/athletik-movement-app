"use client";

// Client (customer) self-registration — 2-step wizard per the product
// brief: step 1 collects Vorname/Nachname/E-Mail ("Angaben"), step 2 the
// Passwort. Both steps are submitted together in ONE request to
// /api/auth/register once step 2 completes (see that route's comment for
// why) — step 1 "Weiter" only validates and moves the wizard forward
// client-side, no account exists yet until the final submit succeeds.
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getBranding } from "@/lib/branding";

const branding = getBranding();

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleStep1(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setError("Bitte Vor- und Nachnamen angeben.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Bitte eine gültige E-Mail-Adresse angeben.");
      return;
    }
    setStep(2);
  }

  async function handleStep2(e: FormEvent) {
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
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registrierung fehlgeschlagen.");
        setSubmitting(false);
        return;
      }
      router.push("/portal");
      router.refresh();
    } catch {
      setError("Registrierung fehlgeschlagen. Bitte später erneut versuchen.");
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
        <h1 className="mt-4 text-2xl font-extrabold">Registrieren</h1>
        <p className="mt-1 text-sm text-slate-500">
          Schritt {step} von 2 · {step === 1 ? "Deine Angaben" : "Passwort erstellen"}
        </p>
      </div>

      {step === 1 ? (
        <form onSubmit={handleStep1} className="mt-8 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700">Vorname</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                autoComplete="given-name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Nachname</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                autoComplete="family-name"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">E-Mail-Adresse</label>
            <p className="text-xs text-slate-400">Das ist gleichzeitig dein Login-Name.</p>
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

          <button type="submit" className="mt-2 rounded-lg bg-ink-900 text-white px-4 py-2 text-sm font-semibold">
            Weiter
          </button>
        </form>
      ) : (
        <form onSubmit={handleStep2} className="mt-8 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Passwort</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              autoComplete="new-password"
              minLength={8}
              required
            />
            <p className="mt-1 text-xs text-slate-400">Mindestens 8 Zeichen.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Passwort bestätigen</label>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Zurück
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-lg bg-ink-900 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {submitting ? "Wird erstellt…" : "Konto erstellen"}
            </button>
          </div>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-slate-500">
        Schon registriert?{" "}
        <Link href="/login" className="font-medium text-brand-700 underline">
          Einloggen
        </Link>
      </p>
    </main>
  );
}
