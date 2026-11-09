import { requireUser } from "@/lib/auth/guards";
import { listProjects, createProject } from "@/lib/projects/service";
import { createProjectSchema } from "@/lib/validation/project";
import { json, parseJson, handleRouteError } from "@/lib/api/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    return json({ projects: await listProjects(user.id) });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const input = await parseJson(req, createProjectSchema);
    const project = await createProject(user.id, input);
    return json({ project }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
