import { getCurrentUser } from "@/lib/auth/session";
import { json, handleRouteError } from "@/lib/api/http";

export async function GET() {
  try {
    const user = await getCurrentUser();
    return json({ user });
  } catch (err) {
    return handleRouteError(err);
  }
}
