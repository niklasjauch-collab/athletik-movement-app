import { redirectIfClientLoggedIn } from "@/lib/auth";

// Coach-only: a logged-in end-customer must not see the client list or
// another client's detail/scan-upload page (see
// src/lib/auth.ts#redirectIfClientLoggedIn). Covers /clients and
// /clients/[id].
export default async function ClientsLayout({ children }: { children: React.ReactNode }) {
  await redirectIfClientLoggedIn();
  return <>{children}</>;
}
