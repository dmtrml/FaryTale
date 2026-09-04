import type { Book } from "@/lib/content/schemas";

export type LibrarySort = "updated-desc" | "created-desc" | "title-asc";

export type LibraryFilterState = {
  character?: string;
  meaning?: string;
  situation?: string;
  collection?: string;
  tag?: string;
  custom?: Record<string, string>;
};

export type LibraryFacets = {
  characters: string[];
  meanings: string[];
  situations: string[];
  collections: string[];
  tags: string[];
  custom: Record<string, string[]>;
};

const collator = new Intl.Collator("ru", { sensitivity: "base" });

function uniqueSorted(values: Iterable<string>) {
  return [...new Set(values)].sort(collator.compare);
}

export function collectLibraryFacets(books: Book[]): LibraryFacets {
  const customValues = new Map<string, Set<string>>();

  for (const book of books) {
    for (const [key, values] of Object.entries(book.classification.custom)) {
      const bucket = customValues.get(key) ?? new Set<string>();
      values.forEach((value) => bucket.add(value));
      customValues.set(key, bucket);
    }
  }

  return {
    characters: uniqueSorted(books.flatMap((book) => book.characters)),
    meanings: uniqueSorted(books.flatMap((book) => book.classification.meanings)),
    situations: uniqueSorted(books.flatMap((book) => book.classification.situations)),
    collections: uniqueSorted(books.flatMap((book) => book.classification.collections)),
    tags: uniqueSorted(books.flatMap((book) => book.classification.tags)),
    custom: Object.fromEntries(
      [...customValues.entries()]
        .sort(([a], [b]) => collator.compare(a, b))
        .map(([key, values]) => [key, uniqueSorted(values)]),
    ),
  };
}

export function filterAndSortBooks(
  books: Book[],
  filters: LibraryFilterState = {},
  sort: LibrarySort = "updated-desc",
) {
  const filtered = books.filter((book) => {
    if (filters.character && !book.characters.includes(filters.character)) return false;
    if (filters.meaning && !book.classification.meanings.includes(filters.meaning)) return false;
    if (filters.situation && !book.classification.situations.includes(filters.situation)) return false;
    if (filters.collection && !book.classification.collections.includes(filters.collection)) return false;
    if (filters.tag && !book.classification.tags.includes(filters.tag)) return false;

    for (const [key, value] of Object.entries(filters.custom ?? {})) {
      if (value && !(book.classification.custom[key] ?? []).includes(value)) return false;
    }

    return true;
  });

  return filtered.sort((a, b) => {
    if (sort === "title-asc") return collator.compare(a.title, b.title);
    if (sort === "created-desc") {
      return b.createdAt.localeCompare(a.createdAt) || collator.compare(a.title, b.title);
    }
    return b.updatedAt.localeCompare(a.updatedAt) || collator.compare(a.title, b.title);
  });
}

export function hasActiveLibraryFilters(filters: LibraryFilterState) {
  return Boolean(
    filters.character ||
      filters.meaning ||
      filters.situation ||
      filters.collection ||
      filters.tag ||
      Object.values(filters.custom ?? {}).some(Boolean),
  );
}
