import { requireUser } from "@/lib/auth/guards";
import { removePaperFromProject, setPaperTags } from "@/lib/projects/service";
import { setTagsSchema } from "@/lib/validation/project";
import { json, parseJson, handleRouteError } from "@/lib/api/http";

export const runtime = "nodejs";

/** Replace the tags on a paper's membership in this project. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; paperId: string }> }
) {
  try {
    const user = await requireUser();
    const { id, paperId } = await params;
    const input = await parseJson(req, setTagsSchema);
    const membership = await setPaperTags(user.id, id, paperId, input.tags);
    return json({ membership });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Remove a paper from this project (the paper itself is not deleted). */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; paperId: string }> }
) {
  try {
    const user = await requireUser();
    const { id, paperId } = await params;
    await removePaperFromProject(user.id, id, paperId);
    return json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
