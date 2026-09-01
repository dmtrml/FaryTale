export function previousPageIndex(current: number) {
  return Math.max(0, current - 1);
}

export function nextPageIndex(current: number, pageCount: number) {
  return Math.min(Math.max(0, pageCount - 1), current + 1);
}

export function pageIndexAfterHorizontalGesture({
  current,
  pageCount,
  deltaX,
  tapX,
  width,
}: {
  current: number;
  pageCount: number;
  deltaX: number;
  tapX: number;
  width: number;
}) {
  const swipeThreshold = 40;
  const tapThreshold = 12;

  if (deltaX <= -swipeThreshold) {
    return nextPageIndex(current, pageCount);
  }

  if (deltaX >= swipeThreshold) {
    return previousPageIndex(current);
  }

  if (Math.abs(deltaX) <= tapThreshold && width > 0) {
    return tapX < width / 2
      ? previousPageIndex(current)
      : nextPageIndex(current, pageCount);
  }

  return current;
}
