"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Book } from "@/lib/content/schemas";
import {
  nextPageIndex,
  pageIndexAfterHorizontalGesture,
  previousPageIndex,
} from "@/lib/reader/navigation";

const progressKey = (bookId: string) => `farytale-reader-progress:${bookId}`;

export function BookReader({ book }: { book: Book }) {
  const [pageIndex, setPageIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());
  const [resumePageIndex, setResumePageIndex] = useState<number | null>(null);
  const [progressReady, setProgressReady] = useState(false);
  const pointerStartX = useRef<number | null>(null);

  const page = book.pages[pageIndex];
  const pageCount = book.pages.length;

  const goPrevious = useCallback(() => {
    setPageIndex((current) => previousPageIndex(current));
  }, []);

  const goNext = useCallback(() => {
    setPageIndex((current) => nextPageIndex(current, pageCount));
  }, [pageCount]);

  useEffect(() => {
    const raw = window.localStorage.getItem(progressKey(book.id));
    const saved = raw === null ? Number.NaN : Number.parseInt(raw, 10);
    const frame = window.requestAnimationFrame(() => {
      if (Number.isFinite(saved) && saved > 0 && saved < pageCount) {
        setResumePageIndex(saved);
      }
      setProgressReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [book.id, pageCount]);

  useEffect(() => {
    if (!progressReady || resumePageIndex !== null) return;
    window.localStorage.setItem(progressKey(book.id), String(pageIndex));
  }, [book.id, pageIndex, progressReady, resumePageIndex]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") {
        goPrevious();
      }
      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        goNext();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, goPrevious]);

  if (!page) {
    return (
      <main className="grid min-h-dvh place-items-center px-6 py-12">
        <section className="text-center">
          <p className="text-xl font-semibold">В этой книге пока нет страниц.</p>
          <Link className="mt-5 inline-block underline" href="/">
            Вернуться на полку
          </Link>
        </section>
      </main>
    );
  }

  const imageFailed = page.image ? failedImages.has(page.image) : false;
  const imageSrc = page.image
    ? `/api/content/books/${encodeURIComponent(book.id)}/asset?path=${encodeURIComponent(page.image)}`
    : null;
  const isLastPage = pageIndex === pageCount - 1;

  function restartBook() {
    setPageIndex(0);
    setResumePageIndex(null);
    window.localStorage.setItem(progressKey(book.id), "0");
  }

  return (
    <main className="min-h-dvh bg-[#f7f2e8] px-3 py-3 sm:px-6 sm:py-5">
      <div className="mx-auto flex min-h-[calc(100dvh-1.5rem)] max-w-6xl flex-col sm:min-h-[calc(100dvh-2.5rem)]">
        <header className="mb-3 flex items-center justify-between gap-4 px-1 sm:mb-4">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-full px-4 font-semibold text-[#514940] focus-visible:outline-2 focus-visible:outline-offset-2"
            aria-label="Закрыть книгу и вернуться на полку"
          >
            ← Полка
          </Link>
          <div
            className="rounded-full bg-white/75 px-4 py-2 text-sm font-semibold text-[#70685e] shadow-sm"
            aria-live="polite"
          >
            {pageIndex + 1} / {pageCount}
          </div>
        </header>

        {resumePageIndex !== null ? (
          <section className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d8d0c5] bg-white/80 px-4 py-3 text-sm shadow-sm">
            <p className="font-medium text-[#514940]">
              Вы остановились на странице {resumePageIndex + 1}.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setPageIndex(resumePageIndex);
                  setResumePageIndex(null);
                }}
                className="rounded-full bg-[#40382f] px-4 py-2 font-semibold text-white"
              >
                Продолжить
              </button>
              <button
                type="button"
                onClick={restartBook}
                className="rounded-full border border-[#d8d0c5] bg-white px-4 py-2 font-semibold"
              >
                Начать сначала
              </button>
            </div>
          </section>
        ) : null}

        <article
          className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface)] shadow-[0_20px_70px_rgba(77,62,43,0.1)] sm:rounded-[2.5rem]"
          aria-label={`Страница ${pageIndex + 1} из ${pageCount}`}
        >
          <div
            className="relative min-h-[50dvh] flex-1 touch-pan-y select-none overflow-hidden bg-[linear-gradient(145deg,#e9efe5,#f2e3cf)] sm:min-h-[58dvh]"
            onPointerDown={(event) => {
              pointerStartX.current = event.clientX;
            }}
            onPointerCancel={() => {
              pointerStartX.current = null;
            }}
            onPointerUp={(event) => {
              const startX = pointerStartX.current;
              pointerStartX.current = null;
              if (startX === null) return;

              const bounds = event.currentTarget.getBoundingClientRect();
              setPageIndex((current) =>
                pageIndexAfterHorizontalGesture({
                  current,
                  pageCount,
                  deltaX: event.clientX - startX,
                  tapX: event.clientX - bounds.left,
                  width: bounds.width,
                }),
              );
            }}
            aria-label="Иллюстрация. Нажмите справа для следующей страницы, слева для предыдущей или проведите пальцем."
          >
            {imageSrc && !imageFailed ? (
              <Image
                src={imageSrc}
                alt={`Иллюстрация к странице ${pageIndex + 1}`}
                fill
                sizes="(max-width: 768px) 100vw, 1100px"
                className="object-contain"
                unoptimized
                priority={pageIndex === 0}
                draggable={false}
                onError={() => {
                  if (!page.image) return;
                  setFailedImages((current) => {
                    const next = new Set(current);
                    next.add(page.image as string);
                    return next;
                  });
                }}
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center px-8 text-center">
                <div>
                  <div className="mx-auto grid size-24 place-items-center rounded-full bg-white/70 text-5xl shadow-sm">
                    🐾
                  </div>
                  <p className="mt-5 text-sm font-medium text-[#766d62]">
                    Иллюстрация появится здесь
                  </p>
                </div>
              </div>
            )}

            <div className="pointer-events-none absolute inset-y-0 left-0 flex w-16 items-center justify-center text-3xl text-[#4d453d]/25 sm:w-24">
              ‹
            </div>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex w-16 items-center justify-center text-3xl text-[#4d453d]/25 sm:w-24">
              ›
            </div>
          </div>

          <div className="px-6 py-6 text-center sm:px-10 sm:py-8">
            <p
              className="mx-auto max-w-3xl text-2xl font-medium leading-snug tracking-tight sm:text-3xl sm:leading-snug"
              aria-live="polite"
            >
              {page.text}
            </p>

            {isLastPage ? (
              <div className="mx-auto mt-6 max-w-xl rounded-2xl bg-[#f4f0e9] px-5 py-5">
                <p className="text-lg font-semibold">Конец ❤️</p>
                <div className="mt-4 flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={restartBook}
                    className="min-h-12 rounded-full bg-[#40382f] px-5 font-semibold text-white"
                  >
                    Прочитать ещё раз
                  </button>
                  <Link
                    href="/"
                    className="inline-flex min-h-12 items-center rounded-full border border-[var(--border)] bg-white px-5 font-semibold"
                  >
                    Выбрать другую сказку
                  </Link>
                </div>
              </div>
            ) : null}

            <div className="mx-auto mt-6 flex max-w-md items-center justify-between gap-4">
              <button
                type="button"
                onClick={goPrevious}
                disabled={pageIndex === 0}
                className="min-h-12 min-w-28 rounded-full border border-[var(--border)] bg-white px-5 font-semibold disabled:cursor-default disabled:opacity-30"
                aria-label="Предыдущая страница"
              >
                Назад
              </button>
              {pageCount <= 10 ? (
                <div className="flex gap-1.5" aria-hidden="true">
                  {book.pages.map((item, index) => (
                    <span
                      key={item.number}
                      className={`size-2 rounded-full ${
                        index === pageIndex ? "bg-[#5c5349]" : "bg-[#d8d0c5]"
                      }`}
                    />
                  ))}
                </div>
              ) : (
                <div className="min-w-24 flex-1" aria-hidden="true">
                  <div className="h-2 overflow-hidden rounded-full bg-[#d8d0c5]">
                    <div
                      className="h-full rounded-full bg-[#5c5349] transition-[width]"
                      style={{ width: `${((pageIndex + 1) / pageCount) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={goNext}
                disabled={isLastPage}
                className="min-h-12 min-w-28 rounded-full bg-[#40382f] px-5 font-semibold text-white disabled:cursor-default disabled:opacity-30"
                aria-label="Следующая страница"
              >
                Дальше
              </button>
            </div>
          </div>
        </article>
      </div>
    </main>
  );
}
