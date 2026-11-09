import { requireUser } from "@/lib/auth/guards";
import { generateGaps } from "@/core/pipelines/generate-gaps";
import { generateGapsRequestSchema } from "@/lib/validation/gaps";
import { json, parseJson, handleRouteError } from "@/lib/api/http";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Section E, step 3: generate & persist candidate gaps for a project. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { projectId } = await parseJson(req, generateGapsRequestSchema);
    const outcome = await generateGaps(user.id, projectId);
    return json(outcome, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
