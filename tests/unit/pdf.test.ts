import { describe, it, expect } from "vitest";

import { extractPdf, looksLikePdf } from "@/lib/documents/pdf";
import { makePdf } from "../fixtures/make-pdf";

describe("extractPdf", () => {
  it("extracts text from a generated PDF", async () => {
    const pdf = makePdf("ScholarSea Test Paper Title");
    expect(looksLikePdf(pdf)).toBe(true);
    const { text, pageCount } = await extractPdf(pdf);
    expect(text).toContain("ScholarSea Test Paper Title");
    expect(pageCount).toBe(1);
  });
});
