import { requireUser } from "@/lib/auth/guards";
import { buildCorpus } from "@/lib/gaps/corpus";
import { detectPatterns } from "@/lib/gaps/patterns";
import { corpusRequestSchema } from "@/lib/validation/gaps";
import { json, parseJson, handleRouteError } from "@/lib/api/http";

export const runtime = "nodejs";

/**
 * Research Gap Explorer steps 1 & 2: build the evidence corpus for a project
 * and return the detected candidate patterns. Owner-guarded via buildCorpus.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { projectId } = await parseJson(req, corpusRequestSchema);
    const corpus = await buildCorpus(user.id, projectId);
    const patterns = detectPatterns(corpus);
    return json({ corpus, patterns });
  } catch (err) {
    return handleRouteError(err);
  }
}
