import { requireUser } from "@/lib/auth/guards";
import { searchArxiv } from "@/lib/search/arxiv";
import { searchQuerySchema } from "@/lib/validation/search";
import { json, handleRouteError } from "@/lib/api/http";

export const runtime = "nodejs";

/** Academic (arXiv) search: /api/search?q=&title=&author=&yearFrom=&yearTo= */
export async function GET(req: Request) {
  try {
    await requireUser();
    const sp = new URL(req.url).searchParams;
    const parsed = searchQuerySchema.parse({
      q: sp.get("q") ?? undefined,
      title: sp.get("title") ?? undefined,
      author: sp.get("author") ?? undefined,
      yearFrom: sp.get("yearFrom") ?? undefined,
      yearTo: sp.get("yearTo") ?? undefined,
      start: sp.get("start") ?? undefined,
      maxResults: sp.get("maxResults") ?? undefined,
    });
    const response = await searchArxiv({
      keyword: parsed.q,
      title: parsed.title,
      author: parsed.author,
      yearFrom: parsed.yearFrom,
      yearTo: parsed.yearTo,
      start: parsed.start,
      maxResults: parsed.maxResults,
    });
    return json(response);
  } catch (err) {
    return handleRouteError(err);
  }
}
