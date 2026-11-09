"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Export the library's papers as BibTeX, Markdown, or JSON. Each option is a
 * download from the owner-scoped export route; every entry maps to a real
 * stored paper (no fabricated citations). An optional `ids` list limits the
 * export to a selection.
 */
export function ExportMenu({
  ids,
  label = "Export",
  disabled,
}: {
  ids?: string[];
  label?: string;
  disabled?: boolean;
}) {
  const qs = ids && ids.length ? `&ids=${ids.join(",")}` : "";
  const href = (format: string) => `/api/export/papers?format=${format}${qs}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <Download /> {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <a href={href("bibtex")} download>
            BibTeX (.bib)
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={href("md")} download>
            Markdown (.md)
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={href("json")} download>
            JSON (.json)
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
