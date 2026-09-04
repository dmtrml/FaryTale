"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Book } from "@/lib/content/schemas";
import {
  collectLibraryFacets,
  filterAndSortBooks,
  hasActiveLibraryFilters,
  type LibraryFilterState,
  type LibrarySort,
} from "@/lib/books/library-filters";

type ChildLibraryShelfProps = {
  books: Book[];
  characterNames: Record<string, string>;
};

const selectClass =
  "min-h-10 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--foreground)] shadow-sm outline-none";

export function ChildLibraryShelf({ books, characterNames }: ChildLibraryShelfProps) {
  const facets = useMemo(() => collectLibraryFacets(books), [books]);
  const [character, setCharacter] = useState("");
  const [meaning, setMeaning] = useState("");
  const [situation, setSituation] = useState("");
  const [sort, setSort] = useState<LibrarySort>("updated-desc");

  const filters: LibraryFilterState = { character, meaning, situation };
  const visibleBooks = filterAndSortBooks(books, filters, sort);
  const showFilters =
    facets.characters.length > 1 || facets.meanings.length > 1 || facets.situations.length > 1;

  function resetFilters() {
    setCharacter("");
    setMeaning("");
    setSituation("");
  }

  return (
    <div>
      {showFilters || books.length > 1 ? (
        <section
          className="mb-4 flex flex-wrap items-center gap-2 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)] p-2.5 shadow-sm"
          aria-label="Подбор сказок"
        >
          {facets.characters.length > 1 ? (
            <select
              className={selectClass}
              aria-label="Фильтр по персонажу"
              value={character}
              onChange={(event) => setCharacter(event.target.value)}
            >
              <option value="">Все герои</option>
              {facets.characters.map((id) => (
                <option key={id} value={id}>
                  {characterNames[id] ?? id}
                </option>
              ))}
            </select>
          ) : null}

          {facets.meanings.length > 1 ? (
            <select
              className={selectClass}
              aria-label="Фильтр по смыслу"
              value={meaning}
              onChange={(event) => setMeaning(event.target.value)}
            >
              <option value="">Любой смысл</option>
              {facets.meanings.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          ) : null}

          {facets.situations.length > 1 ? (
            <select
              className={selectClass}
              aria-label="Фильтр по ситуации"
              value={situation}
              onChange={(event) => setSituation(event.target.value)}
            >
              <option value="">Любая ситуация</option>
              {facets.situations.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          ) : null}

          {books.length > 1 ? (
            <select
              className={`${selectClass} ml-auto`}
              aria-label="Порядок сказок"
              value={sort}
              onChange={(event) => setSort(event.target.value as LibrarySort)}
            >
              <option value="updated-desc">Сначала недавние</option>
              <option value="title-asc">По названию</option>
              <option value="created-desc">Сначала новые</option>
            </select>
          ) : null}

          {hasActiveLibraryFilters(filters) ? (
            <button
              type="button"
              onClick={resetFilters}
              className="min-h-10 rounded-full px-3 text-sm font-semibold text-[var(--muted)] underline"
            >
              Сбросить
            </button>
          ) : null}
        </section>
      ) : null}

      {visibleBooks.length === 0 ? (
        <section className="rounded-[2rem] border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-12 text-center">
          <p className="text-xl font-semibold">Таких сказок пока нет</p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-4 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold"
          >
            Показать все
          </button>
        </section>
      ) : (
        <section
          className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4"
          aria-label="Книги"
        >
          {visibleBooks.map((book, index) => (
            <Link
              key={book.id}
              href={`/books/${book.id}`}
              className="group overflow-hidden rounded-[1.4rem] border border-[var(--border)] bg-[var(--surface)] shadow-[0_12px_36px_rgba(77,62,43,0.07)] transition-transform focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#6f675d] active:scale-[0.99]"
              aria-label={`Открыть книгу «${book.title}»`}
            >
              {book.cover ? (
                <div className="relative aspect-[4/3] overflow-hidden bg-[#f4f0e9]">
                  <Image
                    unoptimized
                    fill
                    sizes="(min-width: 1536px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 100vw"
                    src={`/api/content/books/${book.id}/asset?path=${encodeURIComponent(book.cover)}`}
                    alt={`Обложка книги «${book.title}»`}
                    className="object-cover"
                  />
                </div>
              ) : (
                <div
                  className={`flex aspect-[4/3] items-end p-5 ${
                    index % 2 === 0
                      ? "bg-[linear-gradient(145deg,#dcebdd,#f7e8c8)]"
                      : "bg-[linear-gradient(145deg,#dbe7f3,#f4dfd3)]"
                  }`}
                >
                  <div className="grid size-14 place-items-center rounded-[1.1rem] bg-white/75 text-3xl shadow-sm backdrop-blur-sm">
                    {index % 2 === 0 ? "🐾" : "🧸"}
                  </div>
                </div>
              )}

              <div className="p-4">
                <h2 className="text-lg font-semibold leading-snug tracking-tight sm:text-xl">
                  {book.title}
                </h2>
              </div>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
