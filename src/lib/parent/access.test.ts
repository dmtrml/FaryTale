import { describe, expect, it } from "vitest";
import { isParentModeCookieValue } from "./access";

describe("parent mode cookie", () => {
  it("accepts only the explicit parent-mode value", () => {
    expect(isParentModeCookieValue("1")).toBe(true);
    expect(isParentModeCookieValue("true")).toBe(false);
    expect(isParentModeCookieValue("")).toBe(false);
    expect(isParentModeCookieValue(undefined)).toBe(false);
  });
});
