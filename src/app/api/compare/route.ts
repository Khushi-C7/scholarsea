import { requireUser } from "@/lib/auth/guards";
import { buildComparison } from "@/lib/compare/build";
import { compareRequestSchema } from "@/lib/validation/compare";
import { json, parseJson, handleRouteError } from "@/lib/api/http";

export const runtime = "nodejs";

/** Build a comparison matrix for 2..MAX of the user's papers. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { paperIds } = await parseJson(req, compareRequestSchema);
    const comparison = await buildComparison(user.id, paperIds);
    return json({ comparison });
  } catch (err) {
    return handleRouteError(err);
  }
}
