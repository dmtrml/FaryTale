import { describe, expect, it } from "vitest";
import type { Book } from "@/lib/content/schemas";
import { collectLibraryFacets, filterAndSortBooks } from "./library-filters";

function book(
  id: string,
  title: string,
  overrides: Partial<Book> = {},
): Book {
  return {
    schemaVersion: 1,
    id,
    title,
    language: "ru",
    age: { minMonths: 18, maxMonths: 24, label: "18–24 мес." },
    goal: { type: "habit", slug: id, description: title },
    characters: [],
    classification: {
      meanings: [],
      situations: [],
      collections: [],
      tags: [],
      custom: {},
    },
    references: [],
    status: "ready",
    createdAt: "2026-09-01",
    updatedAt: "2026-09-01",
    pages: [],
    ...overrides,
  };
}

describe("library filtering and sorting", () => {
  const books = [
    book("emi-teeth", "Эми чистит зубки", {
      characters: ["emi"],
      updatedAt: "2026-09-03",
      classification: {
        meanings: ["гигиена", "самостоятельность"],
        situations: ["чистка зубов"],
        collections: ["повседневные навыки"],
        tags: ["ванная"],
        custom: { место: ["ванная"], сложность: ["простая"] },
      },
    }),
    book("miau-paws", "Мяу моет лапки", {
      characters: ["miau"],
      updatedAt: "2026-09-04",
      classification: {
        meanings: ["гигиена"],
        situations: ["мытьё рук"],
        collections: ["повседневные навыки"],
        tags: [],
        custom: { место: ["ванная"] },
      },
    }),
  ];

  it("collects canonical and custom facets without duplicates", () => {
    expect(collectLibraryFacets(books)).toEqual({
      characters: ["emi", "miau"],
      meanings: ["гигиена", "самостоятельность"],
      situations: ["мытьё рук", "чистка зубов"],
      collections: ["повседневные навыки"],
      tags: ["ванная"],
      custom: {
        место: ["ванная"],
        сложность: ["простая"],
      },
    });
  });

  it("combines filters and sorts by updated date by default", () => {
    expect(filterAndSortBooks(books, { meaning: "гигиена" }).map((item) => item.id)).toEqual([
      "miau-paws",
      "emi-teeth",
    ]);
    expect(
      filterAndSortBooks(books, { character: "emi", custom: { сложность: "простая" } }).map(
        (item) => item.id,
      ),
    ).toEqual(["emi-teeth"]);
  });

  it("supports title sorting", () => {
    expect(filterAndSortBooks(books, {}, "title-asc").map((item) => item.title)).toEqual([
      "Мяу моет лапки",
      "Эми чистит зубки",
    ]);
  });
});
