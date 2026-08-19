// Minimal email-sending stub. RESEND_API_KEY isn't set up in this
// sandbox (see .env.example's "Email (Phase 3)" section), so this logs
// the email instead of sending it — good enough to develop/test the
// forgot-password flow without a real provider. Swap sendEmail's body for
// a real Resend/Postmark call once RESEND_API_KEY is configured; nothing
// else in the app needs to change since callers only depend on this
// function's signature.
export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
}

export async function sendEmail({ to, subject, text }: SendEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Dev-mode fallback: no provider configured, just log it so a
    // developer running locally can read the reset link from the
    // terminal. The forgot-password route additionally echoes the link
    // in its JSON response in this case — see the "dev" flag there.
    console.log(`[email:dev] to=${to} subject=${JSON.stringify(subject)}\n${text}`);
    return;
  }

  // TODO (Phase 3): real send via Resend once RESEND_API_KEY is set —
  // intentionally not implemented yet since there's no key to test
  // against in this environment. Example:
  //   await fetch("https://api.resend.com/emails", {
  //     method: "POST",
  //     headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  //     body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text }),
  //   });
  console.log(`[email:todo] RESEND_API_KEY is set but the real send isn't implemented yet. to=${to} subject=${subject}`);
}
