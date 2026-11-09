import { requireUser } from "@/lib/auth/guards";
import { reviewGap } from "@/lib/gaps/gap-service";
import { reviewGapSchema } from "@/lib/validation/gaps";
import { json, parseJson, handleRouteError } from "@/lib/api/http";

export const runtime = "nodejs";

/** Evidence inspector: mark a candidate gap useful/rejected/… and/or add notes. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const input = await parseJson(req, reviewGapSchema);
    const reviewStatus = await reviewGap(user.id, id, input);
    return json({ reviewStatus });
  } catch (err) {
    return handleRouteError(err);
  }
}
