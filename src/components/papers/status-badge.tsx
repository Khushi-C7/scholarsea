import { CheckCircle2, Loader2, XCircle, Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export type ExtractionStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export function PaperStatusBadge({ status }: { status: ExtractionStatus }) {
  switch (status) {
    case "COMPLETED":
      return (
        <Badge variant="success">
          <CheckCircle2 /> Ready
        </Badge>
      );
    case "FAILED":
      return (
        <Badge variant="destructive">
          <XCircle /> Extraction failed
        </Badge>
      );
    case "PROCESSING":
      return (
        <Badge variant="warning">
          <Loader2 className="animate-spin" /> Processing
        </Badge>
      );
    case "CANCELLED":
      return (
        <Badge variant="muted">
          <XCircle /> Cancelled
        </Badge>
      );
    default:
      return (
        <Badge variant="muted">
          <Clock /> Pending
        </Badge>
      );
  }
}
