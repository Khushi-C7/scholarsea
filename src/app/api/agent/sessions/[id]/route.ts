import { requireUser } from "@/lib/auth/guards";
import { getAgentSessionView } from "@/lib/agent/service";
import { json, handleRouteError } from "@/lib/api/http";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    return json({ session: await getAgentSessionView(user.id, id) });
  } catch (err) {
    return handleRouteError(err);
  }
}
