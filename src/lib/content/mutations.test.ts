import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createDraftBook,
  readBookPagePrompt,
  replaceBookPageImage,
  updateBookPageText,
} from "./mutations";
import { loadLibrary } from "./loader";

const roots: string[] = [];

async function makeRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "farytale-parent-"));
  roots.push(root);
  await fs.mkdir(path.join(root, "books", "sample-book", "prompts"), { recursive: true });
  await fs.mkdir(path.join(root, "characters"), { recursive: true });
  await fs.writeFile(
    path.join(root, "books", "sample-book", "book.json"),
    JSON.stringify(
      {
        schemaVersion: 1,
        id: "sample-book",
        title: "Sample",
        language: "ru",
        age: { minMonths: 18, maxMonths: 24, label: "18–24 мес." },
        goal: { type: "habit", slug: "sample", description: "Sample goal" },
        characters: [],
        status: "draft",
        createdAt: "2026-08-01",
        updatedAt: "2026-08-01",
        pages: [
          {
            number: 1,
            text: "Old text",
            prompt: "prompts/001.md",
            characters: [],
            imageStatus: "prompt_ready"
          },
          { number: 2, text: "Keep me", characters: [], imageStatus: "missing" }
        ]
      },
      null,
      2,
    ),
  );
  await fs.writeFile(
    path.join(root, "books", "sample-book", "prompts", "001.md"),
    "# Illustration prompt\n\nA calm scene.\n",
  );
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("parent canonical mutations", () => {
  it("updates one page text without changing the next page", async () => {
    const root = await makeRoot();
    const book = await updateBookPageText({
      contentRoot: root,
      bookId: "sample-book",
      pageNumber: 1,
      text: "New text",
      today: "2026-08-29",
    });

    expect(book.pages[0]?.text).toBe("New text");
    expect(book.pages[1]?.text).toBe("Keep me");
    expect(book.updatedAt).toBe("2026-08-29");
  });

  it("replaces one page image and persists canonical image metadata", async () => {
    const root = await makeRoot();
    const bytes = new Uint8Array([
      137, 80, 78, 71, 13, 10, 26, 10,
      0, 0, 0, 13, 73, 72, 68, 82,
      0, 0, 0, 16, 0, 0, 0, 9,
    ]);
    const result = await replaceBookPageImage({
      contentRoot: root,
      bookId: "sample-book",
      pageNumber: 1,
      bytes,
      mimeType: "image/png",
      today: "2026-08-29",
    });

    expect(result.book.pages[0]?.image).toBe("pages/001.png");
    expect(result.book.pages[0]?.imageStatus).toBe("ready");
    expect(result.inspection).toMatchObject({ width: 16, height: 9, mimeType: "image/png" });
    expect(await fs.readFile(result.imagePath)).toEqual(Buffer.from(bytes));
  });

  it("rejects a fake image before marking the page ready", async () => {
    const root = await makeRoot();
    await expect(
      replaceBookPageImage({
        contentRoot: root,
        bookId: "sample-book",
        pageNumber: 1,
        bytes: new Uint8Array([1, 2, 3, 4]),
        mimeType: "image/png",
      }),
    ).rejects.toThrow("does not match");
  });

  it("rejects a page illustration that is not 16:9", async () => {
    const root = await makeRoot();
    const square = new Uint8Array([
      137, 80, 78, 71, 13, 10, 26, 10,
      0, 0, 0, 13, 73, 72, 68, 82,
      0, 0, 0, 16, 0, 0, 0, 16,
    ]);
    await expect(
      replaceBookPageImage({
        contentRoot: root,
        bookId: "sample-book",
        pageNumber: 1,
        bytes: square,
        mimeType: "image/png",
      }),
    ).rejects.toThrow("16:9");
  });

  it("reads only the prompt declared by the canonical page", async () => {
    const root = await makeRoot();
    const prompt = await readBookPagePrompt({
      contentRoot: root,
      bookId: "sample-book",
      pageNumber: 1,
    });

    expect(prompt).toContain("A calm scene.");
  });

  it("creates a valid discoverable draft book", async () => {
    const root = await makeRoot();
    const draft = await createDraftBook({
      contentRoot: root,
      id: "draft-test-book",
      title: "Новая сказка",
      goalDescription: "Показать простое действие.",
      pageCount: 5,
      minMonths: 18,
      maxMonths: 24,
      today: "2026-08-29",
    });
    const library = await loadLibrary({ contentRoot: root });

    expect(draft.status).toBe("draft");
    expect(draft.pages).toHaveLength(5);
    expect(library.books.some((book) => book.id === "draft-test-book")).toBe(true);
  });

  it("rejects unsafe book ids before touching the filesystem", async () => {
    const root = await makeRoot();
    await expect(
      updateBookPageText({
        contentRoot: root,
        bookId: "../outside",
        pageNumber: 1,
        text: "Nope",
      }),
    ).rejects.toThrow("Invalid book id");
  });
});
