import { describe, expect, it } from "vitest";
import {
  nextPageIndex,
  pageIndexAfterHorizontalGesture,
  previousPageIndex,
} from "./navigation";

describe("reader navigation", () => {
  it("clamps previous/next navigation to book boundaries", () => {
    expect(previousPageIndex(0)).toBe(0);
    expect(previousPageIndex(3)).toBe(2);
    expect(nextPageIndex(0, 5)).toBe(1);
    expect(nextPageIndex(4, 5)).toBe(4);
  });

  it("maps left/right swipes to next/previous pages", () => {
    expect(
      pageIndexAfterHorizontalGesture({
        current: 2,
        pageCount: 5,
        deltaX: -80,
        tapX: 100,
        width: 400,
      }),
    ).toBe(3);

    expect(
      pageIndexAfterHorizontalGesture({
        current: 2,
        pageCount: 5,
        deltaX: 80,
        tapX: 300,
        width: 400,
      }),
    ).toBe(1);
  });

  it("maps taps on the left/right half to previous/next pages", () => {
    expect(
      pageIndexAfterHorizontalGesture({
        current: 2,
        pageCount: 5,
        deltaX: 3,
        tapX: 60,
        width: 400,
      }),
    ).toBe(1);

    expect(
      pageIndexAfterHorizontalGesture({
        current: 2,
        pageCount: 5,
        deltaX: -2,
        tapX: 340,
        width: 400,
      }),
    ).toBe(3);
  });
});
