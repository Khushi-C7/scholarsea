import { requireUser, getOwnedProject } from "@/lib/auth/guards";
import { buildGraph } from "@/lib/graph/build";
import { json, handleRouteError } from "@/lib/api/http";

export const runtime = "nodejs";

/**
 * The knowledge graph for the signed-in user's library. Owner-scoped; an
 * optional `projectId` restricts it to one owned project (404 if not owned).
 */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const projectId =
      new URL(req.url).searchParams.get("projectId")?.trim() || undefined;
    if (projectId) {
      await getOwnedProject(projectId, user.id); // 404 if not owned
    }
    return json(await buildGraph(user.id, { projectId }));
  } catch (err) {
    return handleRouteError(err);
  }
}
