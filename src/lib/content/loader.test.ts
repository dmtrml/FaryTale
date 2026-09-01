import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  isSafeContentPath,
  loadLibrary,
  writeLibraryManifest,
} from "./loader";

const tempRoots: string[] = [];

async function makeContentRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "farytale-content-"));
  tempRoots.push(root);
  await fs.mkdir(path.join(root, "books"), { recursive: true });
  await fs.mkdir(path.join(root, "characters"), { recursive: true });
  return root;
}

async function writeJson(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

function sampleBook(
  id: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    schemaVersion: 1,
    id,
    title: "Sample Book",
    language: "en",
    age: { minMonths: 18, maxMonths: 24, label: "18–24 months" },
    goal: {
      type: "habit",
      slug: "sample-habit",
      description: "Show a simple routine.",
    },
    characters: [],
    status: "ready",
    createdAt: "2026-08-29",
    updatedAt: "2026-08-29",
    pages: [
      {
        number: 1,
        text: "One simple event.",
        image: "pages/001.webp",
        prompt: "prompts/001.md",
        characters: [],
        imageStatus: "ready",
      },
    ],
    ...overrides,
  };
}

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

describe("content path safety", () => {
  it("accepts portable relative paths and rejects traversal/absolute paths", () => {
    expect(isSafeContentPath("pages/001.webp")).toBe(true);
    expect(isSafeContentPath("../outside.webp")).toBe(false);
    expect(isSafeContentPath("pages/../../outside.webp")).toBe(false);
    expect(isSafeContentPath("/absolute.webp")).toBe(false);
    expect(isSafeContentPath("C:/absolute.webp")).toBe(false);
    expect(isSafeContentPath("pages\\001.webp")).toBe(false);
  });
});

describe("loadLibrary", () => {
  it("discovers a valid book directly from its canonical folder", async () => {
    const root = await makeContentRoot();
    const bookRoot = path.join(root, "books", "sample-book");
    await writeJson(path.join(bookRoot, "book.json"), sampleBook("sample-book"));
    await fs.mkdir(path.join(bookRoot, "pages"), { recursive: true });
    await fs.mkdir(path.join(bookRoot, "prompts"), { recursive: true });
    await fs.writeFile(path.join(bookRoot, "pages", "001.webp"), "image");
    await fs.writeFile(path.join(bookRoot, "prompts", "001.md"), "# Prompt\n");

    const library = await loadLibrary({ contentRoot: root });

    expect(library.books.map((book) => book.id)).toEqual(["sample-book"]);
    expect(library.diagnostics).toEqual([]);
  });

  it("reports malformed JSON without crashing discovery", async () => {
    const root = await makeContentRoot();
    const bookRoot = path.join(root, "books", "broken-book");
    await fs.mkdir(bookRoot, { recursive: true });
    await fs.writeFile(path.join(bookRoot, "book.json"), "{not-json", "utf8");

    const library = await loadLibrary({ contentRoot: root });

    expect(library.books).toEqual([]);
    expect(library.diagnostics[0]?.code).toBe("invalid_json");
  });

  it("rejects books whose pages are not consecutive and ordered", async () => {
    const root = await makeContentRoot();
    await writeJson(
      path.join(root, "books", "bad-order", "book.json"),
      sampleBook("bad-order", {
        pages: [
          {
            number: 2,
            text: "Wrong first page.",
            characters: [],
            imageStatus: "missing",
          },
        ],
      }),
    );

    const library = await loadLibrary({ contentRoot: root });

    expect(library.books).toEqual([]);
    expect(library.diagnostics.some((item) => item.code === "invalid_page_order")).toBe(
      true,
    );
  });

  it("keeps a book readable when an illustration is missing", async () => {
    const root = await makeContentRoot();
    await writeJson(
      path.join(root, "books", "missing-image", "book.json"),
      sampleBook("missing-image", {
        pages: [
          {
            number: 1,
            text: "The image file is absent.",
            image: "pages/001.webp",
            characters: [],
            imageStatus: "ready",
          },
        ],
      }),
    );

    const library = await loadLibrary({ contentRoot: root });

    expect(library.books).toHaveLength(1);
    expect(library.diagnostics).toContainEqual(
      expect.objectContaining({ code: "missing_asset", severity: "warning" }),
    );
  });

  it("rejects a book containing a path traversal attempt", async () => {
    const root = await makeContentRoot();
    await writeJson(
      path.join(root, "books", "unsafe-book", "book.json"),
      sampleBook("unsafe-book", { cover: "../../outside.webp" }),
    );

    const library = await loadLibrary({ contentRoot: root });

    expect(library.books).toEqual([]);
    expect(library.diagnostics.some((item) => item.code === "unsafe_path")).toBe(true);
  });

  it("warns about unresolved character references without hiding the book", async () => {
    const root = await makeContentRoot();
    await writeJson(
      path.join(root, "books", "character-book", "book.json"),
      sampleBook("character-book", {
        characters: ["miau"],
        pages: [
          {
            number: 1,
            text: "Miau appears.",
            characters: ["miau"],
            imageStatus: "missing",
          },
        ],
      }),
    );

    const library = await loadLibrary({ contentRoot: root });

    expect(library.books).toHaveLength(1);
    expect(library.diagnostics).toContainEqual(
      expect.objectContaining({ code: "missing_character", severity: "warning" }),
    );
  });
});

describe("writeLibraryManifest", () => {
  it("writes a deterministic manifest rebuilt from canonical books", async () => {
    const root = await makeContentRoot();
    await writeJson(
      path.join(root, "books", "second-book", "book.json"),
      sampleBook("second-book", { pages: [] }),
    );
    await writeJson(
      path.join(root, "books", "first-book", "book.json"),
      sampleBook("first-book", { pages: [] }),
    );

    const firstWrite = await writeLibraryManifest({ contentRoot: root });
    const firstRaw = await fs.readFile(firstWrite.manifestPath, "utf8");
    const secondWrite = await writeLibraryManifest({ contentRoot: root });
    const secondRaw = await fs.readFile(secondWrite.manifestPath, "utf8");

    expect(firstWrite.manifest.books.map((book) => book.id)).toEqual([
      "first-book",
      "second-book",
    ]);
    expect(firstRaw).toBe(secondRaw);
  });
});
