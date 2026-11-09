import { requireUser } from "@/lib/auth/guards";
import { createAgentSession } from "@/core/pipelines/agent-run";
import { listAgentSessions } from "@/lib/agent/service";
import { createSessionSchema } from "@/lib/validation/agent";
import { json, parseJson, handleRouteError } from "@/lib/api/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    return json({ sessions: await listAgentSessions(user.id) });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { goal, projectId } = await parseJson(req, createSessionSchema);
    const id = await createAgentSession(user.id, goal, projectId);
    return json({ id }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
