import { requireUser } from "@/lib/auth/guards";
import { analyzePaper } from "@/core/pipelines/analyze-paper";
import { json, handleRouteError } from "@/lib/api/http";

export const runtime = "nodejs";
// Hobby plan caps functions at 60s; raise to 300 if deploying on Vercel Pro.
export const maxDuration = 60;

/** Run the multi-agent analysis pipeline on one of the user's papers. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const outcome = await analyzePaper(user.id, id);
    return json(
      {
        analysisId: outcome.analysisId,
        version: outcome.version,
        status: outcome.status,
        demo: outcome.demo,
        tokensUsed: outcome.tokensUsed,
        stages: outcome.stages,
        error: outcome.error ?? null,
      },
      { status: outcome.status === "COMPLETED" ? 201 : 200 }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
