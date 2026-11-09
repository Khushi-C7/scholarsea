import { describe, it, expect } from "vitest";

import {
  validatePdfUpload,
  validateTextInput,
  classifyFetched,
} from "@/lib/documents/validate";
import { looksLikePdf } from "@/lib/documents/pdf";
import { LIMITS } from "@/lib/documents/limits";
import {
  UnsupportedFileTypeError,
  FileTooLargeError,
  EmptyContentError,
} from "@/lib/documents/errors";
import {
  parseYear,
  metadataFromHtml,
  metadataFromText,
  htmlToText,
} from "@/lib/documents/metadata";

const PDF_HEADER = Buffer.from("%PDF-1.7\n...", "latin1");

describe("looksLikePdf", () => {
  it("accepts a %PDF- header", () => expect(looksLikePdf(PDF_HEADER)).toBe(true));
  it("rejects plain text", () =>
    expect(looksLikePdf(Buffer.from("hello world"))).toBe(false));
  it("rejects a disguised extension (content wins)", () =>
    expect(looksLikePdf(Buffer.from("<html></html>"))).toBe(false));
});

describe("validatePdfUpload", () => {
  it("accepts a valid small PDF", () => {
    expect(() => validatePdfUpload(PDF_HEADER)).not.toThrow();
  });
  it("rejects an empty file", () => {
    expect(() => validatePdfUpload(Buffer.alloc(0))).toThrow(EmptyContentError);
  });
  it("rejects a non-PDF file", () => {
    expect(() => validatePdfUpload(Buffer.from("just text, not a pdf"))).toThrow(
      UnsupportedFileTypeError
    );
  });
  it("rejects a file over the size limit", () => {
    // A buffer that starts with the PDF header but exceeds the cap.
    const big = Buffer.concat([
      PDF_HEADER,
      Buffer.alloc(LIMITS.MAX_PDF_BYTES + 10),
    ]);
    expect(() => validatePdfUpload(big)).toThrow(FileTooLargeError);
  });
});

describe("validateTextInput", () => {
  it("accepts reasonable text", () => {
    expect(() =>
      validateTextInput("This is a perfectly reasonable abstract to ingest.")
    ).not.toThrow();
  });
  it("rejects too-short text", () => {
    expect(() => validateTextInput("short")).toThrow(EmptyContentError);
  });
  it("rejects too-long text", () => {
    expect(() =>
      validateTextInput("x".repeat(LIMITS.MAX_TEXT_CHARS + 1))
    ).toThrow(FileTooLargeError);
  });
});

describe("classifyFetched", () => {
  it("detects PDF by magic bytes even with wrong content-type", () => {
    expect(classifyFetched(PDF_HEADER, "text/html")).toBe("pdf");
  });
  it("detects PDF by content-type", () => {
    expect(classifyFetched(Buffer.from("x"), "application/pdf")).toBe("pdf");
  });
  it("defaults to html otherwise", () => {
    expect(classifyFetched(Buffer.from("<html>"), "text/html")).toBe("html");
  });
});

describe("metadata helpers", () => {
  it("parses a plausible year, ignoring implausible ones", () => {
    expect(parseYear("Published in 2021")).toBe(2021);
    expect(parseYear("year 1850")).toBeNull();
    expect(parseYear("no year here")).toBeNull();
  });

  it("extracts scholarly metadata from HTML meta tags", () => {
    const html = `<html><head>
      <meta name="citation_title" content="Deep Nets for Leaves">
      <meta name="citation_author" content="Rivera, A.">
      <meta name="citation_author" content="Okafor, S.">
      <meta name="citation_publication_date" content="2023/05/01">
      <meta name="citation_doi" content="10.1234/abcd">
      <meta name="citation_abstract" content="A short abstract about leaves.">
      </head><body>ignored</body></html>`;
    const meta = metadataFromHtml(html, "https://arxiv.org/abs/2305.00001");
    expect(meta.title).toBe("Deep Nets for Leaves");
    expect(meta.authors).toEqual(["Rivera, A.", "Okafor, S."]);
    expect(meta.year).toBe(2023);
    expect(meta.doi).toBe("10.1234/abcd");
    expect(meta.arxivId).toBe("2305.00001");
    expect(meta.abstract).toContain("leaves");
  });

  it("never invents metadata it cannot find", () => {
    const meta = metadataFromHtml("<html><body>no meta here</body></html>", "https://x.test/");
    expect(meta.authors).toEqual([]);
    expect(meta.year).toBeNull();
    expect(meta.doi).toBeNull();
  });

  it("derives a title from pasted text when none is provided", () => {
    const meta = metadataFromText("A Title Line\n\nBody text follows here.");
    expect(meta.title).toBe("A Title Line");
  });

  it("strips HTML to readable text", () => {
    expect(htmlToText("<p>Hello <b>world</b></p><script>bad()</script>")).toBe(
      "Hello world"
    );
  });
});
