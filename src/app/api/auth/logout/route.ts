import { destroySession } from "@/lib/auth/session";
import { json, handleRouteError } from "@/lib/api/http";

export async function POST() {
  try {
    await destroySession();
    return json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
