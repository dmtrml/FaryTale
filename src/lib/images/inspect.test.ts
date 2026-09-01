import { describe, expect, it } from "vitest";
import { inspectImage } from "./inspect";

function png(width: number, height: number) {
  return new Uint8Array([
    137, 80, 78, 71, 13, 10, 26, 10,
    0, 0, 0, 13, 73, 72, 68, 82,
    (width >>> 24) & 255, (width >>> 16) & 255, (width >>> 8) & 255, width & 255,
    (height >>> 24) & 255, (height >>> 16) & 255, (height >>> 8) & 255, height & 255,
  ]);
}

describe("inspectImage", () => {
  it("reads PNG dimensions from image bytes", () => {
    expect(inspectImage(png(1024, 768), "image/png")).toEqual({
      mimeType: "image/png",
      width: 1024,
      height: 768,
    });
  });

  it("rejects content that does not match the declared mime type", () => {
    expect(() => inspectImage(new Uint8Array([1, 2, 3]), "image/png")).toThrow(
      "does not match",
    );
  });

  it("rejects unreasonable dimensions", () => {
    expect(() => inspectImage(png(9000, 10), "image/png")).toThrow("8192px");
  });
});
