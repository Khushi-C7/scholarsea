import { describe, it, expect } from "vitest";

import { assertOwner } from "@/lib/auth/guards";
import { ForbiddenError } from "@/lib/auth/errors";

describe("assertOwner", () => {
  it("allows the owner", () => {
    expect(() => assertOwner("user_a", "user_a")).not.toThrow();
  });

  it("forbids a non-owner", () => {
    expect(() => assertOwner("user_a", "user_b")).toThrow(ForbiddenError);
  });

  it("the thrown error carries a 403 status", () => {
    try {
      assertOwner("user_a", "user_b");
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ForbiddenError);
      expect((e as ForbiddenError).status).toBe(403);
    }
  });
});
