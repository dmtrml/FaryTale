"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Book } from "@/lib/content/schemas";
import { bookIllustrationProgress, bookStatusLabel } from "@/lib/books/presentation";
import {
  collectLibraryFacets,
  filterAndSortBooks,
  hasActiveLibraryFilters,
  type LibraryFilterState,
  type LibrarySort,
} from "@/lib/books/library-filters";

type ParentBookLibraryProps = {
  books: Book[];
  characterNames: Record<string, string>;
};

const selectClass =
  "min-h-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--foreground)] outline-none";

export function ParentBookLibrary({ books, characterNames }: ParentBookLibraryProps) {
  const facets = useMemo(() => collectLibraryFacets(books), [books]);
  const [character, setCharacter] = useState("");
  const [meaning, setMeaning] = useState("");
  const [situation, setSituation] = useState("");
  const [collection, setCollection] = useState("");
  const [tag, setTag] = useState("");
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<LibrarySort>("updated-desc");

  const filters: LibraryFilterState = {
    character,
    meaning,
    situation,
    collection,
    tag,
    custom,
  };
  const visibleBooks = filterAndSortBooks(books, filters, sort);

  function resetFilters() {
    setCharacter("");
    setMeaning("");
    setSituation("");
    setCollection("");
    setTag("");
    setCustom({});
  }

  function control(
    label: string,
    value: string,
    options: string[],
    onChange: (value: string) => void,
    renderValue: (value: string) => string = (item) => item,
  ) {
    if (options.length === 0) return null;
    return (
      <label className="grid gap-1 text-xs font-semibold text-[var(--muted)]">
        <span>{label}</span>
        <select className={selectClass} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Все</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {renderValue(option)}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <>
      <section className="mt-7 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Фильтры и сортировка</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Показано {visibleBooks.length} из {books.length}
            </p>
          </div>
          <label className="grid gap-1 text-xs font-semibold text-[var(--muted)]">
            <span>Сортировка</span>
            <select
              className={selectClass}
              value={sort}
              onChange={(event) => setSort(event.target.value as LibrarySort)}
            >
              <option value="updated-desc">Недавно обновлённые</option>
              <option value="created-desc">Новые сначала</option>
              <option value="title-asc">По названию</option>
            </select>
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {control("Персонаж", character, facets.characters, setCharacter, (id) => characterNames[id] ?? id)}
          {control("Смысл", meaning, facets.meanings, setMeaning)}
          {control("Ситуация / навык", situation, facets.situations, setSituation)}
          {control("Коллекция", collection, facets.collections, setCollection)}
          {control("Тег", tag, facets.tags, setTag)}
          {Object.entries(facets.custom).map(([key, options]) => (
            <div key={key}>
              {control(key, custom[key] ?? "", options, (value) =>
                setCustom((current) => ({ ...current, [key]: value })),
              )}
            </div>
          ))}
        </div>

        {hasActiveLibraryFilters(filters) ? (
          <button
            type="button"
            onClick={resetFilters}
            className="mt-4 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold"
          >
            Сбросить фильтры
          </button>
        ) : null}
      </section>

      {visibleBooks.length === 0 ? (
        <section className="mt-5 rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-10 text-center">
          <p className="font-semibold">По выбранным параметрам книг нет.</p>
          <button type="button" className="mt-3 text-sm font-semibold underline" onClick={resetFilters}>
            Показать все книги
          </button>
        </section>
      ) : (
        <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleBooks.map((book) => {
            const progress = bookIllustrationProgress(book);
            const labels = [
              ...new Set([
                ...book.characters.map((id) => characterNames[id] ?? id),
                ...book.classification.meanings,
                ...book.classification.situations,
              ]),
            ];
            return (
              <Link
                key={book.id}
                href={`/parent/books/${book.id}`}
                className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-sm transition-transform active:scale-[0.99]"
              >
                {book.cover ? (
                  <div className="relative aspect-[4/3] bg-[#f4f0e9]">
                    <Image
                      unoptimized
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      src={`/api/parent/books/${book.id}/asset?path=${encodeURIComponent(book.cover)}`}
                      alt={`Обложка книги «${book.title}»`}
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="grid aspect-[4/3] place-items-center bg-[#f4f0e9] text-5xl">📕</div>
                )}
                <div className="p-5">
                  <div className="flex items-center justify-between gap-3 text-sm text-[var(--muted)]">
                    <span>{progress.ready}/{progress.total} иллюстраций</span>
                    <span className="rounded-full bg-[#eee8dd] px-3 py-1 font-semibold">
                      {bookStatusLabel(book.status)}
                    </span>
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold leading-tight">{book.title}</h2>
                  {labels.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {labels.slice(0, 5).map((label) => (
                        <span
                          key={label}
                          className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--muted)]"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-[var(--muted)]">Классификация пока не заполнена</p>
                  )}
                  <p className="mt-4 text-sm font-semibold">
                    {progress.complete ? "Готово ✓" : `Продолжить · осталось ${progress.remaining} →`}
                  </p>
                </div>
              </Link>
            );
          })}
        </section>
      )}
    </>
  );
}
