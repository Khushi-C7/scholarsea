import { authenticateUser } from "@/lib/auth/service";
import { createSession } from "@/lib/auth/session";
import { loginSchema } from "@/lib/validation/auth";
import { json, parseJson, handleRouteError } from "@/lib/api/http";

export async function POST(req: Request) {
  try {
    const input = await parseJson(req, loginSchema);
    const user = await authenticateUser(input);
    await createSession(user.id);
    return json({ user });
  } catch (err) {
    return handleRouteError(err);
  }
}
