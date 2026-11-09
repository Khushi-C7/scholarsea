import { requireUser } from "@/lib/auth/guards";
import { recommendRelated } from "@/lib/search/recommend";
import { json, handleRouteError } from "@/lib/api/http";

export const runtime = "nodejs";

/** Related papers from the user's library, with relevance explanations. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    return json({ recommendations: await recommendRelated(user.id, id) });
  } catch (err) {
    return handleRouteError(err);
  }
}
