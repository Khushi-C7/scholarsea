import { requireUser } from "@/lib/auth/guards";
import { getGapAnalysisView } from "@/lib/gaps/gap-service";
import { json, handleRouteError } from "@/lib/api/http";

export const runtime = "nodejs";

/** Full view of one gap analysis (owner-guarded). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    return json({ analysis: await getGapAnalysisView(user.id, id) });
  } catch (err) {
    return handleRouteError(err);
  }
}
