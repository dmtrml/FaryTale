import type { Book } from "@/lib/content/schemas";

export const bookStatusLabels = {
  draft: "Черновик",
  text_ready: "Текст готов",
  prompt_ready: "Нужны иллюстрации",
  illustrating: "Иллюстрируется",
  ready: "Готова",
  archived: "В архиве",
} as const;

export function bookStatusLabel(status: Book["status"]) {
  return bookStatusLabels[status] ?? status;
}

export function bookIllustrationProgress(book: Book) {
  const ready = book.pages.filter((page) => page.imageStatus === "ready" && page.image).length;
  return {
    ready,
    total: book.pages.length,
    remaining: Math.max(0, book.pages.length - ready),
    complete: ready === book.pages.length && book.pages.length > 0,
    firstIncompletePage:
      book.pages.find((page) => page.imageStatus !== "ready" || !page.image)?.number ?? null,
  };
}
