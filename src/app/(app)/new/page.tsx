import { PageContainer, PageHeader } from "@/components/layout/page";
import { Card, CardContent } from "@/components/ui/card";
import { IngestForm } from "@/components/papers/ingest-form";

export const metadata = { title: "New Research" };

export default function NewPage() {
  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        title="New Research"
        description="Bring a paper into ScholarSea by pasting its text, uploading a PDF, or giving a public URL."
      />
      <Card>
        <CardContent className="pt-6">
          <IngestForm />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
