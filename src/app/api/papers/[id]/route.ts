import { requireUser, getOwnedPaper } from "@/lib/auth/guards";
import { toPaperSummary } from "@/lib/documents/serialize";
import { json, handleRouteError } from "@/lib/api/http";

export const runtime = "nodejs";

/** Fetch one of the current user's papers (status + metadata). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const paper = await getOwnedPaper(id, user.id);
    return json({ paper: toPaperSummary(paper) });
  } catch (err) {
    return handleRouteError(err);
  }
}
