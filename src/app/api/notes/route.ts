import { requireUser } from "@/lib/auth/guards";
import {
  createNote,
  listNotesForProject,
  listNotesForPaper,
  listBookmarkedNotes,
} from "@/lib/projects/notes";
import { createNoteSchema } from "@/lib/validation/project";
import { json, parseJson, handleRouteError } from "@/lib/api/http";

export const runtime = "nodejs";

/** List notes by ?projectId=, ?paperId=, or ?bookmarked=1. */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    const paperId = url.searchParams.get("paperId");
    const bookmarked = url.searchParams.get("bookmarked");

    if (projectId) {
      return json({ notes: await listNotesForProject(user.id, projectId) });
    }
    if (paperId) {
      return json({ notes: await listNotesForPaper(user.id, paperId) });
    }
    if (bookmarked === "1" || bookmarked === "true") {
      return json({ notes: await listBookmarkedNotes(user.id) });
    }
    return json({ notes: [] });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const input = await parseJson(req, createNoteSchema);
    const note = await createNote(user.id, input);
    return json({ note }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
