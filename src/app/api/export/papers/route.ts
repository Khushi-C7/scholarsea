import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { toBibtex, type ExportablePaper } from "@/lib/export/bibtex";
import { toMarkdown, toJson } from "@/lib/export/papers";
import { handleRouteError } from "@/lib/api/http";
import { AppError } from "@/lib/auth/errors";

export const runtime = "nodejs";

const FORMATS = {
  md: { ext: "md", type: "text/markdown; charset=utf-8" },
  json: { ext: "json", type: "application/json; charset=utf-8" },
  bibtex: { ext: "bib", type: "application/x-bibtex; charset=utf-8" },
} as const;
type Format = keyof typeof FORMATS;

/**
 * Export the user's paper metadata as Markdown, JSON, or BibTeX. Owner-scoped;
 * an optional `ids` list restricts the selection. Every exported entry comes
 * from a real stored Paper row — citations map to real sources.
 */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const format = (url.searchParams.get("format") ?? "bibtex") as Format;
    if (!(format in FORMATS)) {
      throw new AppError("Unknown export format", 400, "bad_format");
    }
    const idsParam = url.searchParams.get("ids")?.trim();
    const ids = idsParam ? idsParam.split(",").map((s) => s.trim()).filter(Boolean) : null;

    const papers = await prisma.paper.findMany({
      where: {
        ownerId: user.id,
        ...(ids && ids.length ? { id: { in: ids } } : {}),
      },
      select: {
        id: true,
        title: true,
        authors: true,
        year: true,
        venue: true,
        doi: true,
        arxivId: true,
        url: true,
        abstract: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const rows: ExportablePaper[] = papers;
    const body =
      format === "bibtex"
        ? toBibtex(rows)
        : format === "md"
          ? toMarkdown(rows)
          : toJson(rows);

    const { ext, type } = FORMATS[format];
    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": type,
        "content-disposition": `attachment; filename="scholarsea-papers-${new Date()
          .toISOString()
          .slice(0, 10)}.${ext}"`,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
