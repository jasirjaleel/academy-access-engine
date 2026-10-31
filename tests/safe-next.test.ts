import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/safe-next";

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/dashboard/billing?x=1")).toBe("/dashboard/billing?x=1");
  });

  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "/\\/evil.com", "/\tevil", "", null, 42])(
    "falls back for %j",
    (value) => {
      expect(safeNext(value)).toBe("/dashboard");
    },
  );
});
