import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createDraftBook, replaceBookPageImage } from "./mutations";
import { loadLibrary } from "./loader";
import { preparePagePrompt } from "../story/generator";
import {
  addCharacterReference,
  createCharacter,
  deleteBookPage,
  deleteCharacter,
  duplicateBookPage,
  insertBookPage,
  moveBookPage,
  replaceBookCover,
  replaceBookEnvironmentReference,
  removeCharacterReference,
  setCharacterIdentityReference,
  updateBookMetadata,
  updateBookPageCharacters,
  updateCharacter,
  updateCharacterReferenceRole,
} from "./authoring";

const roots: string[] = [];
const png = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10,
  0, 0, 0, 13, 73, 72, 68, 82,
  0, 0, 0, 16, 0, 0, 0, 9,
]);

const portraitPng = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10,
  0, 0, 0, 13, 73, 72, 68, 82,
  0, 0, 0, 2, 0, 0, 0, 3,
]);

async function makeRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "farytale-authoring-"));
  roots.push(root);
  await fs.mkdir(path.join(root, "books", "sample-book", "pages"), { recursive: true });
  await fs.mkdir(path.join(root, "books", "sample-book", "prompts"), { recursive: true });
  await fs.mkdir(path.join(root, "characters"), { recursive: true });
  await fs.writeFile(
    path.join(root, "books", "sample-book", "book.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      id: "sample-book",
      title: "Sample",
      language: "ru",
      age: { minMonths: 18, maxMonths: 24, label: "18–24 мес." },
      goal: { type: "habit", slug: "sample", description: "Old goal" },
      characters: [],
      status: "ready",
      createdAt: "2026-08-01",
      updatedAt: "2026-08-01",
      authoring: {
        skill: "childrens-story-creator-v1",
        ageBand: "18-24m",
        storyPattern: "habit-routine",
        outline: [
          { pageNumber: 1, beat: "One" },
          { pageNumber: 2, beat: "Two" },
          { pageNumber: 3, beat: "Three" },
        ],
      },
      pages: [
        { number: 1, text: "One", image: "pages/001.png", prompt: "prompts/001.md", characters: [], imageStatus: "ready" },
        { number: 2, text: "Two", characters: [], imageStatus: "missing" },
        { number: 3, text: "Three", characters: [], imageStatus: "missing" },
      ],
    }, null, 2)}\n`,
  );
  await fs.writeFile(path.join(root, "books", "sample-book", "pages", "001.png"), png);
  await fs.writeFile(path.join(root, "books", "sample-book", "prompts", "001.md"), "Prompt one\n");
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("complete book authoring", () => {
  it("supports an 80-page draft and can grow it beyond 80 pages", async () => {
    const root = await makeRoot();
    const book = await createDraftBook({
      contentRoot: root,
      id: "long-family-book",
      title: "Большая книга",
      goalDescription: "Проверить длинную книгу.",
      pageCount: 80,
      minMonths: 18,
      maxMonths: 60,
      today: "2026-08-29",
    });
    expect(book.pages).toHaveLength(80);
    const grown = await insertBookPage({ contentRoot: root, bookId: book.id, position: 41 });
    expect(grown.pages).toHaveLength(81);
    expect(grown.pages[40]?.number).toBe(41);
    expect(grown.pages[80]?.number).toBe(81);
  });

  it("inserts, moves and renumbers pages while keeping their content attached", async () => {
    const root = await makeRoot();
    const inserted = await insertBookPage({ contentRoot: root, bookId: "sample-book", position: 2, today: "2026-08-29" });
    expect(inserted.pages.map((page) => page.text)).toEqual(["One", "", "Two", "Three"]);
    expect(inserted.pages.map((page) => page.number)).toEqual([1, 2, 3, 4]);
    expect(inserted.authoring?.outline.map((item) => item.pageNumber)).toEqual([1, 2, 3, 4]);
    expect(inserted.status).toBe("draft");

    const moved = await moveBookPage({ contentRoot: root, bookId: "sample-book", pageNumber: 4, targetPosition: 1 });
    expect(moved.pages.map((page) => page.text)).toEqual(["Three", "One", "", "Two"]);
    expect(moved.pages.map((page) => page.number)).toEqual([1, 2, 3, 4]);
    expect(moved.authoring?.outline.map((item) => item.beat)).toEqual([
      "Three",
      "One",
      "Новая страница — требуется уточнить действие.",
      "Two",
    ]);
  });

  it("does not overwrite another page asset or prompt after reordering", async () => {
    const root = await makeRoot();
    const moved = await moveBookPage({ contentRoot: root, bookId: "sample-book", pageNumber: 1, targetPosition: 3 });
    expect(moved.pages[2]?.image).toBe("pages/001.png");
    expect(moved.pages[2]?.prompt).toBe("prompts/001.md");

    const replaced = await replaceBookPageImage({
      contentRoot: root,
      bookId: "sample-book",
      pageNumber: 1,
      bytes: png,
      mimeType: "image/png",
    });
    expect(replaced.book.pages[0]?.image).toMatch(/^pages\/assets\//);
    expect(replaced.book.pages[2]?.image).toBe("pages/001.png");
    expect(await fs.readFile(path.join(root, "books", "sample-book", "pages", "001.png"))).toEqual(Buffer.from(png));

    const prompted = await preparePagePrompt({
      contentRoot: root,
      bookId: "sample-book",
      pageNumber: 1,
      storyPattern: "habit-routine",
      today: "2026-08-29",
    });
    expect(prompted.pages[0]?.prompt).toMatch(/^prompts\/assets\//);
    expect(prompted.pages[2]?.prompt).toBe("prompts/001.md");
    expect(await fs.readFile(path.join(root, "books", "sample-book", "prompts", "001.md"), "utf8")).toBe("Prompt one\n");
  });

  it("duplicates page assets into independent paths", async () => {
    const root = await makeRoot();
    const book = await duplicateBookPage({ contentRoot: root, bookId: "sample-book", pageNumber: 1 });
    const source = book.pages[0]!;
    const copy = book.pages[1]!;
    expect(copy.text).toBe(source.text);
    expect(copy.image).toMatch(/^pages\/copies\//);
    expect(copy.prompt).toMatch(/^prompts\/copies\//);
    expect(copy.image).not.toBe(source.image);
    expect(copy.prompt).not.toBe(source.prompt);
    expect(await fs.readFile(path.join(root, "books", "sample-book", ...copy.image!.split("/")))).toEqual(Buffer.from(png));
    expect(await fs.readFile(path.join(root, "books", "sample-book", ...copy.prompt!.split("/")), "utf8")).toBe("Prompt one\n");
  });

  it("archives deleted page assets and keeps at least one page", async () => {
    const root = await makeRoot();
    const book = await deleteBookPage({ contentRoot: root, bookId: "sample-book", pageNumber: 1 });
    expect(book.pages.map((page) => page.text)).toEqual(["Two", "Three"]);
    await expect(fs.access(path.join(root, "books", "sample-book", "pages", "001.png"))).rejects.toThrow();
    const archiveFolders = await fs.readdir(path.join(root, "books", "sample-book", "archive", "deleted-pages"));
    expect(archiveFolders.length).toBeGreaterThan(0);

    await deleteBookPage({ contentRoot: root, bookId: "sample-book", pageNumber: 1 });
    await expect(deleteBookPage({ contentRoot: root, bookId: "sample-book", pageNumber: 1 })).rejects.toThrow("at least one page");
  });

  it("edits metadata, lifecycle and book/page character membership", async () => {
    const root = await makeRoot();
    await createCharacter({
      contentRoot: root,
      id: "miau",
      name: "Мяу",
      type: "animal",
      species: "kitten",
      narrativeDescription: "Добрый котёнок.",
      identity: "Маленький серый котёнок.",
    });
    const updated = await updateBookMetadata({
      contentRoot: root,
      bookId: "sample-book",
      title: "Новая книга",
      language: "ru",
      goalDescription: "Новая цель",
      minMonths: 12,
      maxMonths: 36,
      status: "prompt_ready",
      characterIds: ["miau"],
      today: "2026-08-29",
    });
    expect(updated).toMatchObject({ title: "Новая книга", status: "prompt_ready", characters: ["miau"] });
    expect(updated.language).toBe("ru");
    expect(updated.age).toMatchObject({ minMonths: 12, maxMonths: 36 });
    const pageUpdated = await updateBookPageCharacters({ contentRoot: root, bookId: "sample-book", pageNumber: 2, characterIds: ["miau"] });
    expect(pageUpdated.pages[1]?.characters).toEqual(["miau"]);
  });

  it("replaces the canonical book cover with a validated independent asset", async () => {
    const root = await makeRoot();
    const result = await replaceBookCover({
      contentRoot: root,
      bookId: "sample-book",
      bytes: portraitPng,
      mimeType: "image/png",
      today: "2026-08-29",
    });
    expect(result.book.cover).toMatch(/^covers\//);
    expect(result.inspection).toMatchObject({ width: 2, height: 3, mimeType: "image/png" });
    expect(await fs.readFile(path.join(root, "books", "sample-book", ...result.relativePath.split("/")))).toEqual(Buffer.from(portraitPng));
  });

  it("stores exactly one canonical environment reference for the book", async () => {
    const root = await makeRoot();
    const first = await replaceBookEnvironmentReference({
      contentRoot: root,
      bookId: "sample-book",
      bytes: png,
      mimeType: "image/png",
      today: "2026-09-03",
    });
    expect(first.book.references).toHaveLength(1);
    expect(first.book.references[0]).toMatchObject({ id: "environment", role: "environment" });
    expect(first.relativePath).toMatch(/^refs\/environment-/);

    const second = await replaceBookEnvironmentReference({
      contentRoot: root,
      bookId: "sample-book",
      bytes: png,
      mimeType: "image/png",
      today: "2026-09-03",
    });
    expect(second.book.references).toHaveLength(1);
    expect(second.relativePath).not.toBe(first.relativePath);
    await expect(fs.access(path.join(root, "books", "sample-book", ...first.relativePath.split("/")))).rejects.toThrow();
  });

  it("rejects a non-16:9 environment reference", async () => {
    const root = await makeRoot();
    await expect(
      replaceBookEnvironmentReference({
        contentRoot: root,
        bookId: "sample-book",
        bytes: portraitPng,
        mimeType: "image/png",
      }),
    ).rejects.toThrow("16:9");
  });
});

describe("complete character authoring", () => {
  it("creates, edits and manages canonical identity references", async () => {
    const root = await makeRoot();
    await createCharacter({
      contentRoot: root,
      id: "miau",
      name: "Мяу",
      type: "animal",
      narrativeDescription: "Котёнок.",
      identity: "Серый котёнок.",
      fixedTraits: ["зелёные глаза"],
    });
    const edited = await updateCharacter({
      contentRoot: root,
      characterId: "miau",
      name: "Котёнок Мяу",
      type: "animal",
      species: "kitten",
      narrativeDescription: "Добрый любопытный котёнок.",
      identity: "Маленький серый котёнок с зелёными глазами.",
      palette: ["серый", "зелёный"],
      fixedTraits: ["зелёные глаза"],
      doNotChange: ["не менять пропорции"],
    });
    expect(edited.name).toBe("Котёнок Мяу");

    const first = await addCharacterReference({
      contentRoot: root,
      characterId: "miau",
      bytes: png,
      mimeType: "image/png",
      role: "front",
      makeIdentity: true,
    });
    const second = await addCharacterReference({
      contentRoot: root,
      characterId: "miau",
      bytes: png,
      mimeType: "image/png",
      role: "side",
    });
    expect(first.character.references[0]?.role).toBe("identity");
    const roleChanged = await updateCharacterReferenceRole({
      contentRoot: root,
      characterId: "miau",
      referenceId: second.referenceId,
      role: "three-quarter",
    });
    expect(roleChanged.references.find((item) => item.id === second.referenceId)?.role).toBe("three-quarter");
    const identityChanged = await setCharacterIdentityReference({ contentRoot: root, characterId: "miau", referenceId: second.referenceId });
    expect(identityChanged.references.find((item) => item.id === second.referenceId)?.role).toBe("identity");
    expect(identityChanged.references.find((item) => item.id === first.referenceId)?.role).toBe("reference");
    const afterRemove = await removeCharacterReference({ contentRoot: root, characterId: "miau", referenceId: first.referenceId });
    expect(afterRemove.references).toHaveLength(1);
  });

  it("blocks deleting a used character and allows deleting an unused one", async () => {
    const root = await makeRoot();
    await createCharacter({ contentRoot: root, id: "used", name: "Used", type: "person", narrativeDescription: "Used.", identity: "Used visual." });
    await createCharacter({ contentRoot: root, id: "unused", name: "Unused", type: "person", narrativeDescription: "Unused.", identity: "Unused visual." });
    await updateBookMetadata({
      contentRoot: root,
      bookId: "sample-book",
      title: "Sample",
      language: "ru",
      goalDescription: "Old goal",
      minMonths: 18,
      maxMonths: 24,
      status: "draft",
      characterIds: ["used"],
    });
    await expect(deleteCharacter({ contentRoot: root, characterId: "used" })).rejects.toThrow("still used");
    await deleteCharacter({ contentRoot: root, characterId: "unused" });
    const library = await loadLibrary({ contentRoot: root });
    expect(library.characters.some((character) => character.id === "unused")).toBe(false);
  });
});
