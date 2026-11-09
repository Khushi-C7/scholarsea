import { requireUser } from "@/lib/auth/guards";
import { ask } from "@/lib/chat/service";
import { askSchema } from "@/lib/validation/chat";
import { json, parseJson, handleRouteError } from "@/lib/api/http";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Ask a question in a conversation; returns the user + assistant messages. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const { question } = await parseJson(req, askSchema);
    const result = await ask(user.id, id, question);
    return json(result, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
