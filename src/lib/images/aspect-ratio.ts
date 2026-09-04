export const BOOK_ILLUSTRATION_ASPECT_WIDTH = 16;
export const BOOK_ILLUSTRATION_ASPECT_HEIGHT = 9;
export const BOOK_ILLUSTRATION_ASPECT_LABEL = "16:9";

const TARGET_RATIO = BOOK_ILLUSTRATION_ASPECT_WIDTH / BOOK_ILLUSTRATION_ASPECT_HEIGHT;
const DEFAULT_TOLERANCE = 0.015;

export function isBookIllustrationAspectRatio(
  width: number,
  height: number,
  tolerance = DEFAULT_TOLERANCE,
) {
  if (width <= 0 || height <= 0) return false;
  const ratio = width / height;
  return Math.abs(ratio - TARGET_RATIO) / TARGET_RATIO <= tolerance;
}

export function assertBookIllustrationAspectRatio(
  width: number,
  height: number,
  label = "Image",
) {
  if (!isBookIllustrationAspectRatio(width, height)) {
    throw new Error(`${label} must use a horizontal 16:9 aspect ratio.`);
  }
}
