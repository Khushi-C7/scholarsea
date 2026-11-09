import { requireUser } from "@/lib/auth/guards";
import { updateNote, deleteNote } from "@/lib/projects/notes";
import { updateNoteSchema } from "@/lib/validation/project";
import { json, parseJson, handleRouteError } from "@/lib/api/http";

export const runtime = "nodejs";

/** Edit a note's body and/or toggle its bookmark. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const input = await parseJson(req, updateNoteSchema);
    const note = await updateNote(user.id, id, input);
    return json({ note });
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
    await deleteNote(user.id, id);
    return json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
