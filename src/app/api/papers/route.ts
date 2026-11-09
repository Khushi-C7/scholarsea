import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/guards";
import { ingestPaper, type IngestInput } from "@/lib/documents/ingest";
import {
  PAPER_SUMMARY_SELECT,
  toPaperSummary,
} from "@/lib/documents/serialize";
import { jsonIngestSchema } from "@/lib/validation/paper";
import { LIMITS } from "@/lib/documents/limits";
import {
  DuplicatePaperError,
  UnsupportedFileTypeError,
  FileTooLargeError,
} from "@/lib/documents/errors";
import { json, parseJson, handleRouteError } from "@/lib/api/http";

export const runtime = "nodejs";

/** Ingest a paper (pasted text or URL via JSON; PDF via multipart). */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const contentType = req.headers.get("content-type") ?? "";

    let input: IngestInput;
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        throw new UnsupportedFileTypeError("No file was provided");
      }
      if (file.size > LIMITS.MAX_PDF_BYTES) {
        throw new FileTooLargeError(
          `PDF exceeds the ${Math.round(LIMITS.MAX_PDF_BYTES / (1024 * 1024))} MB limit`
        );
      }
      const bytes = Buffer.from(await file.arrayBuffer());
      input = { source: "PDF_UPLOAD", filename: file.name, bytes };
    } else {
      const body = await parseJson(req, jsonIngestSchema);
      input =
        body.source === "pasted_text"
          ? { source: "PASTED_TEXT", title: body.title ?? null, text: body.text }
          : { source: "URL", url: body.url };
    }

    const paper = await ingestPaper(user.id, input);
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

/** List the current user's papers (summary view, newest first). */
export async function GET() {
  try {
    const user = await requireUser();
    const papers = await prisma.paper.findMany({
      where: { ownerId: user.id },
      select: PAPER_SUMMARY_SELECT,
      orderBy: { createdAt: "desc" },
    });
    return json({ papers: papers.map(toPaperSummary) });
  } catch (err) {
    return handleRouteError(err);
  }
}
