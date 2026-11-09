import { describe, it, expect } from "vitest";
import { z } from "zod";

import { completeJson, extractJson } from "@/lib/ai/complete";
import { AIValidationError } from "@/lib/ai/errors";
import { createDemoProvider } from "@/lib/ai/demo";
import type { AIProvider, CompletionRequest } from "@/lib/ai/types";

const schema = z.object({ ok: z.boolean() });

/** Provider that returns queued texts, one per call. */
function queuedProvider(texts: string[]): AIProvider {
  let i = 0;
  return {
    name: "mock",
    model: "mock",
    isDemo: false,
    async complete() {
      const t = texts[Math.min(i, texts.length - 1)];
      i += 1;
      return { text: t, usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } };
    },
  };
}

/** Provider whose call hangs until its signal aborts. */
function hangingProvider(): AIProvider {
  return {
    name: "slow",
    model: "slow",
    isDemo: false,
    complete(req: CompletionRequest) {
      return new Promise((_resolve, reject) => {
        req.signal?.addEventListener("abort", () =>
          reject(new Error("aborted"))
        );
      });
    },
  };
}

describe("extractJson", () => {
  it("strips ```json fences", () => {
    expect(extractJson('```json\n{"ok":true}\n```')).toBe('{"ok":true}');
  });
  it("isolates JSON from surrounding prose", () => {
    expect(extractJson('Here you go: {"ok":true} thanks')).toBe('{"ok":true}');
  });
  it("handles arrays", () => {
    expect(extractJson("```\n[1,2,3]\n```")).toBe("[1,2,3]");
  });
});

describe("completeJson", () => {
  const args = {
    schema,
    system: "s",
    user: "u",
    demo: () => ({ ok: true }),
  };

  it("uses the demo output on the demo provider (no model call)", async () => {
    const res = await completeJson({ ...args, provider: createDemoProvider() });
    expect(res.demo).toBe(true);
    expect(res.attempts).toBe(0);
    expect(res.data).toEqual({ ok: true });
  });

  it("validates the demo output too (throws if demo is malformed)", async () => {
    await expect(
      completeJson({
        ...args,
        provider: createDemoProvider(),
        // @ts-expect-error intentionally wrong demo shape
        demo: () => ({ ok: "not a boolean" }),
      })
    ).rejects.toThrow();
  });

  it("retries past invalid JSON then succeeds", async () => {
    const res = await completeJson({
      ...args,
      provider: queuedProvider(["not json at all", '{"ok":true}']),
    });
    expect(res.data).toEqual({ ok: true });
    expect(res.attempts).toBe(2);
    expect(res.usage.totalTokens).toBe(4); // 2 calls
  });

  it("retries past schema-invalid output then succeeds", async () => {
    const res = await completeJson({
      ...args,
      provider: queuedProvider(['{"ok":"nope"}', '{"ok":false}']),
    });
    expect(res.data).toEqual({ ok: false });
    expect(res.attempts).toBe(2);
  });

  it("throws AIValidationError after exhausting retries", async () => {
    await expect(
      completeJson({
        ...args,
        provider: queuedProvider(['{"ok":"never valid"}']),
        maxRetries: 1,
      })
    ).rejects.toBeInstanceOf(AIValidationError);
  });

  it("times out a hanging provider and eventually throws", async () => {
    await expect(
      completeJson({
        ...args,
        provider: hangingProvider(),
        maxRetries: 0,
        timeoutMs: 50,
      })
    ).rejects.toBeInstanceOf(AIValidationError);
  });
});
