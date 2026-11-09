import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/guards";
import { importArxivPaper } from "@/lib/search/import";
import { importArxivSchema } from "@/lib/validation/search";
import { toPaperSummary } from "@/lib/documents/serialize";
import { DuplicatePaperError } from "@/lib/documents/errors";
import { json, parseJson, handleRouteError } from "@/lib/api/http";

export const runtime = "nodejs";

/** Import a real arXiv result into the user's library (dedup-aware). */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const input = await parseJson(req, importArxivSchema);
    const paper = await importArxivPaper(user.id, input);
    return json({ paper: toPaperSummary(paper) }, { status: 201 });
  } catch (err) {
    if (err instanceof DuplicatePaperError) {
      return NextResponse.json(
        {
          error: { message: err.message, code: err.code },
          existingPaperId: err.existingPaperId || null,
        },
        { status: 409 }
      );
    }
    return handleRouteError(err);
  }
}
