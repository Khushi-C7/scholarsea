import { requireUser } from "@/lib/auth/guards";
import { createConversation, listConversations } from "@/lib/chat/service";
import { createConversationSchema } from "@/lib/validation/chat";
import { json, parseJson, handleRouteError } from "@/lib/api/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    return json({ conversations: await listConversations(user.id) });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const input = await parseJson(req, createConversationSchema);
    const id = await createConversation(user.id, input);
    return json({ id }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
