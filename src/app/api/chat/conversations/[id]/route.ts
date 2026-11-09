import { requireUser } from "@/lib/auth/guards";
import { getConversationView } from "@/lib/chat/service";
import { json, handleRouteError } from "@/lib/api/http";

export const runtime = "nodejs";

/** Full conversation with its message history (owner-guarded). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    return json({ conversation: await getConversationView(user.id, id) });
  } catch (err) {
    return handleRouteError(err);
  }
}
