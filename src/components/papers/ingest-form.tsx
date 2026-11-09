"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ClipboardType,
  FileUp,
  Link2,
  Loader2,
  TriangleAlert,
  CheckCircle2,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  PaperStatusBadge,
  type ExtractionStatus,
} from "@/components/papers/status-badge";
import { AcademicSearch } from "@/components/papers/academic-search";

interface IngestedPaper {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  source: string;
  extractionStatus: ExtractionStatus;
  extractionError: string | null;
}

interface SubmitState {
  loading: boolean;
  error: string | null;
  duplicateId: string | null;
  result: IngestedPaper | null;
}

const INITIAL: SubmitState = {
  loading: false,
  error: null,
  duplicateId: null,
  result: null,
};

export function IngestForm() {
  const router = useRouter();
  const [state, setState] = React.useState<SubmitState>(INITIAL);

  // Form field state
  const [title, setTitle] = React.useState("");
  const [text, setText] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);

  async function submit(makeRequest: () => Promise<Response>) {
    setState({ ...INITIAL, loading: true });
    try {
      const res = await makeRequest();
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setState({
          loading: false,
          error: data?.error?.message ?? "Something went wrong.",
          duplicateId: data?.existingPaperId ?? null,
          result: null,
        });
        return;
      }
      setState({
        loading: false,
        error: null,
        duplicateId: null,
        result: data.paper,
      });
      router.refresh();
    } catch {
      setState({
        loading: false,
        error: "Network error. Please try again.",
        duplicateId: null,
        result: null,
      });
    }
  }

  const submitJson = (body: unknown) =>
    submit(() =>
      fetch("/api/papers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
    );

  const submitFile = () => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    return submit(() => fetch("/api/papers", { method: "POST", body: fd }));
  };

  return (
    <div className="space-y-5">
      <Tabs defaultValue="paste" onValueChange={() => setState(INITIAL)}>
        <TabsList>
          <TabsTrigger value="paste">
            <ClipboardType /> Paste text
          </TabsTrigger>
          <TabsTrigger value="pdf">
            <FileUp /> Upload PDF
          </TabsTrigger>
          <TabsTrigger value="url">
            <Link2 /> From URL
          </TabsTrigger>
          <TabsTrigger value="search">
            <Search /> Academic search
          </TabsTrigger>
        </TabsList>

        {/* Paste text */}
        <TabsContent value="paste">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submitJson({ source: "pasted_text", title: title || undefined, text });
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="title">Title (optional)</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Leave blank to detect from the text"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="text">Paper text</Label>
              <Textarea
                id="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste the abstract or full text here…"
                className="min-h-48"
                required
              />
            </div>
            <SubmitButton loading={state.loading} disabled={text.trim().length < 20}>
              Add paper
            </SubmitButton>
          </form>
        </TabsContent>

        {/* Upload PDF */}
        <TabsContent value="pdf">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submitFile();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="file">PDF file</Label>
              <Input
                id="file"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="cursor-pointer file:mr-3 file:cursor-pointer"
                required
              />
              <p className="text-xs text-muted-foreground">
                Up to 20 MB. Scanned PDFs without a text layer can&apos;t be
                extracted.
              </p>
            </div>
            <SubmitButton loading={state.loading} disabled={!file}>
              Upload &amp; analyze
            </SubmitButton>
          </form>
        </TabsContent>

        {/* From URL */}
        <TabsContent value="url">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submitJson({ source: "url", url });
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="url">Public paper URL</Label>
              <Input
                id="url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://arxiv.org/abs/…"
                required
              />
              <p className="text-xs text-muted-foreground">
                Must be a public http(s) page or PDF. Internal and private
                addresses are blocked.
              </p>
            </div>
            <SubmitButton loading={state.loading} disabled={url.trim().length < 4}>
              Fetch &amp; analyze
            </SubmitButton>
          </form>
        </TabsContent>

        {/* Academic search (arXiv) */}
        <TabsContent value="search">
          <AcademicSearch />
        </TabsContent>
      </Tabs>

      {/* Result / error */}
      {state.error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-[color:var(--destructive)]"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <div className="space-y-1">
            <p>{state.error}</p>
            {state.duplicateId ? (
              <Link
                href={`/library?highlight=${state.duplicateId}`}
                className="font-medium underline"
              >
                View the existing paper
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      {state.result ? (
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[color:var(--success)]" />
              <div>
                <p className="font-medium">{state.result.title}</p>
                <p className="text-xs text-muted-foreground">
                  {[
                    state.result.authors.slice(0, 3).join(", "),
                    state.result.year,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Metadata not detected"}
                </p>
              </div>
            </div>
            <PaperStatusBadge status={state.result.extractionStatus} />
          </div>
          {state.result.extractionError ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {state.result.extractionError}
            </p>
          ) : null}
          <div className="mt-4 flex gap-2">
            <Button asChild size="sm">
              <Link href="/library">Go to library</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setState(INITIAL)}
            >
              Add another
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SubmitButton({
  loading,
  disabled,
  children,
}: {
  loading: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button type="submit" disabled={loading || disabled}>
      {loading ? <Loader2 className="animate-spin" /> : null}
      {children}
    </Button>
  );
}
