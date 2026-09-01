import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadLibrary } from "../content/loader";
import { buildBookExport, importBookExport, validateBookExport } from "./package";
import { createStoredZip } from "./zip";

const roots: string[] = [];

function png() {
  return new Uint8Array([
    137, 80, 78, 71, 13, 10, 26, 10,
    0, 0, 0, 13, 73, 72, 68, 82,
    0, 0, 0, 2, 0, 0, 0, 2,
  ]);
}

async function sourceFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "farytale-export-source-"));
  roots.push(root);
  await fs.mkdir(path.join(root, "books", "portable-book", "pages"), { recursive: true });
  await fs.mkdir(path.join(root, "books", "portable-book", "prompts"), { recursive: true });
  await fs.mkdir(path.join(root, "characters", "miau", "refs"), { recursive: true });
  await fs.writeFile(path.join(root, "books", "portable-book", "pages", "001.png"), png());
  await fs.writeFile(path.join(root, "books", "portable-book", "prompts", "001.md"), "# Prompt\n");
  await fs.writeFile(path.join(root, "characters", "miau", "refs", "canonical.png"), png());
  await fs.writeFile(
    path.join(root, "characters", "miau", "character.json"),
    JSON.stringify({
      schemaVersion: 1,
      id: "miau",
      name: "Мяу",
      type: "animal",
      species: "kitten",
      narrativeDescription: "Котёнок.",
      visual: { identity: "Stable Miau.", palette: [], fixedTraits: [], doNotChange: [] },
      references: [{ id: "canonical", path: "refs/canonical.png", role: "identity" }],
    }),
  );
  await fs.writeFile(
    path.join(root, "books", "portable-book", "book.json"),
    JSON.stringify({
      schemaVersion: 1,
      id: "portable-book",
      title: "Portable",
      language: "ru",
      age: { minMonths: 18, maxMonths: 24, label: "18–24" },
      goal: { type: "habit", slug: "portable", description: "Portable goal" },
      characters: ["miau"],
      status: "ready",
      createdAt: "2026-08-29",
      updatedAt: "2026-08-29",
      pages: [{
        number: 1,
        text: "Мяу играет.",
        image: "pages/001.png",
        prompt: "prompts/001.md",
        characters: ["miau"],
        imageStatus: "ready",
      }],
    }),
  );
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("FaryTale book export package", () => {
  it("round-trips a canonical book, prompt, image and referenced character into an empty content root", async () => {
    const source = await sourceFixture();
    const zip = await buildBookExport("portable-book", source);
    const validated = validateBookExport(zip);
    expect(validated.book.id).toBe("portable-book");
    expect(validated.characters.map((item) => item.id)).toEqual(["miau"]);
    expect(validated.entries.has("books/portable-book/prompts/001.md")).toBe(true);
    expect(validated.entries.has("characters/miau/refs/canonical.png")).toBe(true);

    const target = await fs.mkdtemp(path.join(os.tmpdir(), "farytale-export-target-"));
    roots.push(target);
    await importBookExport(zip, target);
    const library = await loadLibrary({ contentRoot: target });
    expect(library.books.find((book) => book.id === "portable-book")?.pages[0]?.text).toBe("Мяу играет.");
    expect(library.characters.find((character) => character.id === "miau")?.visual.identity).toBe("Stable Miau.");
    expect(await fs.readFile(path.join(target, "books", "portable-book", "pages", "001.png"))).toEqual(Buffer.from(png()));
  });

  it("rejects an export that omits a declared page image before import writes anything", async () => {
    const manifest = new TextEncoder().encode(JSON.stringify({ format: "farytale-book-export", version: 1, bookId: "broken" }));
    const book = new TextEncoder().encode(JSON.stringify({
      schemaVersion: 1,
      id: "broken",
      title: "Broken",
      language: "ru",
      age: { minMonths: 18, maxMonths: 24, label: "18–24" },
      goal: { type: "habit", slug: "broken", description: "Broken" },
      characters: [],
      status: "ready",
      createdAt: "2026-08-29",
      updatedAt: "2026-08-29",
      pages: [{ number: 1, text: "x", image: "pages/001.png", characters: [], imageStatus: "ready" }],
    }));
    const zip = createStoredZip([
      { path: "export.json", bytes: manifest },
      { path: "books/broken/book.json", bytes: book },
    ]);
    expect(() => validateBookExport(zip)).toThrow("missing declared page image");
  });

  it("rejects unsafe ZIP paths at writer boundary", () => {
    expect(() => createStoredZip([{ path: "../outside.txt", bytes: new Uint8Array([1]) }])).toThrow("Unsafe ZIP entry path");
  });
});
