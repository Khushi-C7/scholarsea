import { describe, it, expect } from "vitest";

import { buildArxivUrl, ARXIV_API, MAX_RESULTS_CAP } from "@/lib/search/arxiv-query";
import { parseArxivFeed, decodeEntities } from "@/lib/search/arxiv-parse";
import { SearchQueryError } from "@/lib/search/errors";

describe("buildArxivUrl", () => {
  it("builds an all: clause for a keyword and quotes multi-word phrases", () => {
    const url = buildArxivUrl({ keyword: "graph neural networks" });
    const sp = new URL(url).searchParams;
    expect(url.startsWith(ARXIV_API)).toBe(true);
    expect(sp.get("search_query")).toBe('all:"graph neural networks"');
    expect(sp.get("sortBy")).toBe("relevance");
  });

  it("maps title to ti: and author to au: and AND-combines clauses", () => {
    const url = buildArxivUrl({ title: "attention", author: "Vaswani" });
    const q = new URL(url).searchParams.get("search_query")!;
    expect(q).toBe("ti:attention AND au:Vaswani");
  });

  it("adds a submittedDate range when years are given", () => {
    const q = new URL(
      buildArxivUrl({ keyword: "transformers", yearFrom: 2020, yearTo: 2023 })
    ).searchParams.get("search_query")!;
    expect(q).toContain("submittedDate:[20200101 TO 20231231]");
  });

  it("caps max_results at the hard cap", () => {
    const sp = new URL(
      buildArxivUrl({ keyword: "x", maxResults: 9999 })
    ).searchParams;
    expect(Number(sp.get("max_results"))).toBe(MAX_RESULTS_CAP);
  });

  it("throws when there is nothing to search", () => {
    expect(() => buildArxivUrl({})).toThrow(SearchQueryError);
  });
});

describe("decodeEntities", () => {
  it("decodes named and numeric entities, ampersand last", () => {
    expect(decodeEntities("a &amp;lt; b")).toBe("a &lt; b");
    expect(decodeEntities("Schr&#246;dinger")).toBe("Schrödinger");
    expect(decodeEntities("&quot;quoted&quot; &amp; done")).toBe(
      '"quoted" & done'
    );
  });
});

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:arxiv="http://arxiv.org/schemas/atom" xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/">
  <opensearch:totalResults>137</opensearch:totalResults>
  <opensearch:startIndex>0</opensearch:startIndex>
  <entry>
    <id>http://arxiv.org/abs/2305.01234v2</id>
    <title>Few-shot Leaf Disease Classification &amp; Beyond</title>
    <summary>We study few-shot methods for plant disease recognition.</summary>
    <published>2023-05-02T00:00:00Z</published>
    <author><name>Ada Lovelace</name></author>
    <author><name>Alan Turing</name></author>
    <link href="http://arxiv.org/abs/2305.01234v2" rel="alternate" type="text/html"/>
    <link title="pdf" href="http://arxiv.org/pdf/2305.01234v2" rel="related" type="application/pdf"/>
    <category term="cs.CV"/>
    <category term="cs.LG"/>
    <arxiv:doi>10.1000/xyz123</arxiv:doi>
  </entry>
  <entry>
    <id>http://arxiv.org/abs/2401.09999</id>
    <title>Metadata-sparse Entry</title>
    <link href="http://arxiv.org/abs/2401.09999" rel="alternate" type="text/html"/>
  </entry>
  <entry>
    <summary>An entry with no id or title must be skipped entirely.</summary>
    <author><name>Nobody</name></author>
  </entry>
</feed>`;

describe("parseArxivFeed", () => {
  it("parses a complete entry with all fields", () => {
    const { results, totalResults } = parseArxivFeed(FEED);
    expect(totalResults).toBe(137);
    const first = results[0];
    expect(first.arxivId).toBe("2305.01234");
    expect(first.version).toBe("v2");
    expect(first.title).toBe("Few-shot Leaf Disease Classification & Beyond");
    expect(first.authors).toEqual(["Ada Lovelace", "Alan Turing"]);
    expect(first.year).toBe(2023);
    expect(first.categories).toEqual(["cs.CV", "cs.LG"]);
    expect(first.pdfUrl).toBe("http://arxiv.org/pdf/2305.01234v2");
    expect(first.url).toBe("http://arxiv.org/abs/2305.01234v2");
    expect(first.doi).toBe("10.1000/xyz123");
  });

  it("keeps a sparse entry but leaves missing metadata null/empty — never invented", () => {
    const { results } = parseArxivFeed(FEED);
    const sparse = results.find((r) => r.arxivId === "2401.09999")!;
    expect(sparse.abstract).toBeNull();
    expect(sparse.authors).toEqual([]);
    expect(sparse.year).toBeNull();
    expect(sparse.doi).toBeNull();
    expect(sparse.categories).toEqual([]);
  });

  it("emits only real entries and skips those without a usable id/title", () => {
    const { results } = parseArxivFeed(FEED);
    // Three <entry> blocks, but the id/title-less one is dropped.
    expect(results.map((r) => r.arxivId)).toEqual(["2305.01234", "2401.09999"]);
  });

  it("returns no results for an empty feed rather than fabricating any", () => {
    const empty = `<feed xmlns="http://www.w3.org/2005/Atom"><opensearch:totalResults>0</opensearch:totalResults></feed>`;
    expect(parseArxivFeed(empty).results).toEqual([]);
  });
});
