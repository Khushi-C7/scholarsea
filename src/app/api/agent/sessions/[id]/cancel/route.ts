import { requireUser } from "@/lib/auth/guards";
import { cancelAgent } from "@/core/pipelines/agent-run";
import { getAgentSessionView } from "@/lib/agent/service";
import { json, handleRouteError } from "@/lib/api/http";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await cancelAgent(user.id, id);
    return json({ session: await getAgentSessionView(user.id, id) });
  } catch (err) {
    return handleRouteError(err);
  }
}
