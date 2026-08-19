import { destroySession } from "@/lib/auth";

// Plain <form method="POST" action="/api/auth/logout"> submit from
// layout.tsx's header (see the logout button) — a 303 redirect back to
// "/" so it works as a full page navigation without needing client JS.
export async function POST(request: Request) {
  await destroySession();
  return Response.redirect(new URL("/", request.url), 303);
}
