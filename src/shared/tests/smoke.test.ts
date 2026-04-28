import { describe, expect, it } from "vitest";

describe("backend smoke", () => {
  it("runs basic assertion", () => {
    expect(2 + 2).toBe(4);
  });
});
