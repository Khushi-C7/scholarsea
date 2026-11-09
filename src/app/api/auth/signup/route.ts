import { registerUser } from "@/lib/auth/service";
import { createSession } from "@/lib/auth/session";
import { signupSchema } from "@/lib/validation/auth";
import { json, parseJson, handleRouteError } from "@/lib/api/http";

export async function POST(req: Request) {
  try {
    const input = await parseJson(req, signupSchema);
    const user = await registerUser(input);
    await createSession(user.id);
    return json({ user }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
