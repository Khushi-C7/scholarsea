import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/session";
import { getGapAnalysisView } from "@/lib/gaps/gap-service";
import { NotFoundError } from "@/lib/auth/errors";
import { PageContainer } from "@/components/layout/page";
import { GapReport } from "@/components/gaps/gap-report";

export const metadata = { title: "Gap Report" };

export default async function GapAnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;

  let analysis;
  try {
    analysis = await getGapAnalysisView(user.id, id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  return (
    <PageContainer className="max-w-4xl">
      <Link
        href={`/gaps?project=${analysis.projectId}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to Gap Explorer
      </Link>
      <h1 className="mb-1 text-xl font-semibold tracking-tight md:text-2xl">
        Research Gap Report
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {analysis.projectName}
      </p>
      <GapReport analysis={analysis} />
    </PageContainer>
  );
}
