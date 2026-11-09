/**
 * Build a minimal but valid single-page PDF containing `bodyText`, with a
 * correct xref table. Used so PDF-extraction tests don't need a binary fixture.
 */
export function makePdf(bodyText: string): Buffer {
  const esc = bodyText.replace(/([()\\])/g, "\\$1");
  const content = `BT /F1 24 Tf 72 700 Td (${esc}) Tj ET`;

  const objs: Record<number, string> = {
    1: "<</Type/Catalog/Pages 2 0 R>>",
    2: "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    3: "<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>",
    4: "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
    5: `<</Length ${Buffer.byteLength(content)}>>stream\n${content}\nendstream`,
  };

  let pdf = "%PDF-1.4\n";
  const offsets: Record<number, number> = {};
  for (let i = 1; i <= 5; i++) {
    offsets[i] = Buffer.byteLength(pdf, "latin1");
    pdf += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }

  const xrefStart = Buffer.byteLength(pdf, "latin1");
  let xref = "xref\n0 6\n0000000000 65535 f \n";
  for (let i = 1; i <= 5; i++) {
    xref += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  }
  const trailer = `trailer\n<</Size 6/Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf + xref + trailer, "latin1");
}
