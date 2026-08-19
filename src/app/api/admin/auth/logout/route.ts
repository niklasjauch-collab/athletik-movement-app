import { destroyAdminSession } from "@/lib/adminAuth";

export async function POST(request: Request) {
  await destroyAdminSession();
  return Response.redirect(new URL("/admin/login", request.url), 303);
}
