import { requireUser } from "@/lib/auth/guards";
import { addPaperToProject } from "@/lib/projects/service";
import { addPaperSchema } from "@/lib/validation/project";
import { json, parseJson, handleRouteError } from "@/lib/api/http";

export const runtime = "nodejs";

/** Add a paper to the project. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const input = await parseJson(req, addPaperSchema);
    const membership = await addPaperToProject(
      user.id,
      id,
      input.paperId,
      input.tags ?? []
    );
    return json({ membership }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
