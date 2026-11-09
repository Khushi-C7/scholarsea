import { requireUser } from "@/lib/auth/guards";
import { listGapAnalyses } from "@/lib/gaps/gap-service";
import { json, handleRouteError } from "@/lib/api/http";

export const runtime = "nodejs";

/** List a project's saved gap analyses: /api/gaps/analyses?projectId=... */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const projectId = new URL(req.url).searchParams.get("projectId");
    if (!projectId) return json({ analyses: [] });
    return json({ analyses: await listGapAnalyses(user.id, projectId) });
  } catch (err) {
    return handleRouteError(err);
  }
}
