import { requireUser } from "@/lib/auth/guards";
import {
  updateProject,
  deleteProject,
  listProjectPapers,
  listProjectTags,
} from "@/lib/projects/service";
import { listProjectReports } from "@/lib/projects/notes";
import { updateProjectSchema } from "@/lib/validation/project";
import { json, parseJson, handleRouteError } from "@/lib/api/http";

export const runtime = "nodejs";

/** Project detail: papers, tags, and saved reports. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const [papers, tags, reports] = await Promise.all([
      listProjectPapers(user.id, id),
      listProjectTags(user.id, id),
      listProjectReports(user.id, id),
    ]);
    return json({ papers, tags, reports });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const input = await parseJson(req, updateProjectSchema);
    const project = await updateProject(user.id, id, input);
    return json({ project });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await deleteProject(user.id, id);
    return json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
