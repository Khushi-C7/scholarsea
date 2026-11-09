import { requireUser } from "@/lib/auth/guards";
import { advanceAgent } from "@/core/pipelines/agent-run";
import { getAgentSessionView } from "@/lib/agent/service";
import { json, handleRouteError } from "@/lib/api/http";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Execute the next pending step and return the updated session view. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const result = await advanceAgent(user.id, id);
    const session = await getAgentSessionView(user.id, id);
    return json({ ...result, session });
  } catch (err) {
    return handleRouteError(err);
  }
}
