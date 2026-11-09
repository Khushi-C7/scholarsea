import { z } from "zod";

import { requireUser } from "@/lib/auth/guards";
import { retryAgentStep } from "@/core/pipelines/agent-run";
import { getAgentSessionView } from "@/lib/agent/service";
import { json, parseJson, handleRouteError } from "@/lib/api/http";

export const runtime = "nodejs";

const retrySchema = z.object({ stepIndex: z.number().int().min(0) });

/** Reset a failed/cancelled step (and later steps) to pending, to re-run. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const { stepIndex } = await parseJson(req, retrySchema);
    await retryAgentStep(user.id, id, stepIndex);
    return json({ session: await getAgentSessionView(user.id, id) });
  } catch (err) {
    return handleRouteError(err);
  }
}
