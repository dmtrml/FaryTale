"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  MAX_PAGE_IMAGE_BYTES,
  createDraftBook,
  replaceBookPageImage,
  updateBookPageText,
} from "@/lib/content/mutations";
import {
  MAX_BOOK_PAGES,
  MAX_BOOK_COVER_BYTES,
  MAX_BOOK_REFERENCE_BYTES,
  MAX_CHARACTER_REFERENCE_BYTES,
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
} from "@/lib/content/authoring";
import {
  PARENT_MODE_COOKIE,
  PARENT_MODE_VALUE,
  requireParentMode,
} from "@/lib/parent/access";
import { prepareManualStoryDraft } from "@/lib/story/generator";
import { storyPatternSchema } from "@/lib/content/schemas";
import { getConfiguredImageProvider } from "@/lib/providers/server-config";
import { generateBookPageImage } from "@/lib/image-generation/service";

export async function enterParentMode() {
  const cookieStore = await cookies();
  cookieStore.set(PARENT_MODE_COOKIE, PARENT_MODE_VALUE, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  redirect("/parent/books");
}

export async function exitParentMode() {
  await requireParentMode();
  const cookieStore = await cookies();
  cookieStore.delete(PARENT_MODE_COOKIE);
  redirect("/");
}

const pageTextSchema = z.string().max(2000);

export async function updatePageTextAction(
  bookId: string,
  pageNumber: number,
  formData: FormData,
) {
  await requireParentMode();
  const text = pageTextSchema.parse(formData.get("text"));
  await updateBookPageText({ bookId, pageNumber, text });
  revalidatePath(`/parent/books/${bookId}`);
  revalidatePath(`/books/${bookId}`);
}

export async function replacePageImageAction(
  bookId: string,
  pageNumber: number,
  formData: FormData,
) {
  await requireParentMode();
  const image = formData.get("image");
  if (!(image instanceof File)) {
    throw new Error("Image file is required.");
  }
  if (image.size === 0 || image.size > MAX_PAGE_IMAGE_BYTES) {
    throw new Error("Image must be between 1 byte and 5 MB.");
  }

  await replaceBookPageImage({
    bookId,
    pageNumber,
    bytes: new Uint8Array(await image.arrayBuffer()),
    mimeType: image.type,
  });
  revalidatePath(`/parent/books/${bookId}`);
  revalidatePath(`/books/${bookId}`);
}

const draftSchema = z.object({
  title: z.string().trim().min(1).max(160),
  goalDescription: z.string().trim().min(1).max(500),
  pageCount: z.coerce.number().int().min(1).max(MAX_BOOK_PAGES),
  minMonths: z.coerce.number().int().min(0).max(144),
  maxMonths: z.coerce.number().int().min(0).max(144),
});

export async function createDraftBookAction(formData: FormData) {
  await requireParentMode();
  const values = draftSchema.parse({
    title: formData.get("title"),
    goalDescription: formData.get("goalDescription"),
    pageCount: formData.get("pageCount"),
    minMonths: formData.get("minMonths"),
    maxMonths: formData.get("maxMonths"),
  });
  if (values.minMonths > values.maxMonths) {
    throw new Error("Minimum age must not exceed maximum age.");
  }

  const book = await createDraftBook(values);
  revalidatePath("/");
  revalidatePath("/parent/books");
  redirect(`/parent/books/${book.id}`);
}

export async function prepareStoryDraftAction(bookId: string, formData: FormData) {
  await requireParentMode();
  const storyPattern = storyPatternSchema.parse(formData.get("storyPattern"));
  const characterValue = formData.get("characterId");
  const characterId = typeof characterValue === "string" && characterValue ? characterValue : undefined;
  const visualStyleValue = formData.get("visualStyle");
  const visualStyle =
    typeof visualStyleValue === "string" && visualStyleValue.trim()
      ? visualStyleValue.trim()
      : undefined;

  await prepareManualStoryDraft({ bookId, storyPattern, characterId, visualStyle });
  revalidatePath(`/parent/books/${bookId}`);
}

export async function generatePageImageAction(bookId: string, pageNumber: number) {
  await requireParentMode();
  const provider = getConfiguredImageProvider();
  await generateBookPageImage({ bookId, pageNumber, provider });
  revalidatePath(`/parent/books/${bookId}`);
  revalidatePath(`/books/${bookId}`);
}

const bookMetadataSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    language: z.string().trim().min(2).max(35),
    goalDescription: z.string().trim().min(1).max(500),
    minMonths: z.coerce.number().int().min(0).max(144),
    maxMonths: z.coerce.number().int().min(0).max(144),
    status: z.enum(["draft", "text_ready", "prompt_ready", "illustrating", "ready", "archived"]),
  })
  .refine((value) => value.minMonths <= value.maxMonths, {
    message: "Minimum age must not exceed maximum age.",
  });

export async function updateBookMetadataAction(bookId: string, formData: FormData) {
  await requireParentMode();
  const values = bookMetadataSchema.parse({
    title: formData.get("title"),
    language: formData.get("language"),
    goalDescription: formData.get("goalDescription"),
    minMonths: formData.get("minMonths"),
    maxMonths: formData.get("maxMonths"),
    status: formData.get("status"),
  });
  const characterIds = formData
    .getAll("characterIds")
    .filter((value): value is string => typeof value === "string" && Boolean(value));
  await updateBookMetadata({ bookId, ...values, characterIds });
  revalidatePath("/");
  revalidatePath(`/parent/books/${bookId}`);
  revalidatePath(`/books/${bookId}`);
}

export async function replaceBookCoverAction(bookId: string, formData: FormData) {
  await requireParentMode();
  const image = formData.get("image");
  if (!(image instanceof File)) throw new Error("Cover image is required.");
  if (image.size === 0 || image.size > MAX_BOOK_COVER_BYTES) throw new Error("Cover image must be between 1 byte and 5 MB.");
  await replaceBookCover({
    bookId,
    bytes: new Uint8Array(await image.arrayBuffer()),
    mimeType: image.type,
  });
  revalidatePath("/");
  revalidatePath("/parent/books");
  revalidatePath(`/parent/books/${bookId}`);
  revalidatePath(`/books/${bookId}`);
}

export async function replaceBookEnvironmentReferenceAction(bookId: string, formData: FormData) {
  await requireParentMode();
  const image = formData.get("image");
  if (!(image instanceof File)) throw new Error("Environment reference image is required.");
  if (image.size === 0 || image.size > MAX_BOOK_REFERENCE_BYTES) {
    throw new Error("Environment reference image must be between 1 byte and 5 MB.");
  }
  await replaceBookEnvironmentReference({
    bookId,
    bytes: new Uint8Array(await image.arrayBuffer()),
    mimeType: image.type,
  });
  revalidatePath(`/parent/books/${bookId}`);
}

export async function updatePageCharactersAction(bookId: string, pageNumber: number, formData: FormData) {
  await requireParentMode();
  const characterIds = formData
    .getAll("characterIds")
    .filter((value): value is string => typeof value === "string" && Boolean(value));
  await updateBookPageCharacters({ bookId, pageNumber, characterIds });
  revalidatePath(`/parent/books/${bookId}`);
  revalidatePath(`/books/${bookId}`);
}

export async function insertPageAction(bookId: string, formData: FormData) {
  await requireParentMode();
  const position = z.coerce.number().int().min(1).max(MAX_BOOK_PAGES).parse(formData.get("position"));
  const book = await insertBookPage({ bookId, position });
  revalidatePath("/");
  revalidatePath(`/parent/books/${bookId}`);
  revalidatePath(`/books/${bookId}`);
  redirect(`/parent/books/${bookId}?page=${Math.min(position, book.pages.length)}`);
}

export async function duplicatePageAction(bookId: string, pageNumber: number) {
  await requireParentMode();
  const book = await duplicateBookPage({ bookId, pageNumber });
  revalidatePath("/");
  revalidatePath(`/parent/books/${bookId}`);
  revalidatePath(`/books/${bookId}`);
  redirect(`/parent/books/${bookId}?page=${Math.min(pageNumber + 1, book.pages.length)}`);
}

export async function deletePageAction(bookId: string, pageNumber: number, formData: FormData) {
  await requireParentMode();
  if (formData.get("confirm") !== "yes") {
    throw new Error("Page deletion must be confirmed.");
  }
  const book = await deleteBookPage({ bookId, pageNumber });
  revalidatePath("/");
  revalidatePath(`/parent/books/${bookId}`);
  revalidatePath(`/books/${bookId}`);
  redirect(`/parent/books/${bookId}?page=${Math.min(pageNumber, book.pages.length)}`);
}

export async function movePageAction(bookId: string, pageNumber: number, formData: FormData) {
  await requireParentMode();
  const targetPosition = z.coerce.number().int().min(1).max(MAX_BOOK_PAGES).parse(formData.get("targetPosition"));
  await moveBookPage({ bookId, pageNumber, targetPosition });
  revalidatePath("/");
  revalidatePath(`/parent/books/${bookId}`);
  revalidatePath(`/books/${bookId}`);
  redirect(`/parent/books/${bookId}?page=${targetPosition}`);
}

function splitLines(value: FormDataEntryValue | null) {
  return typeof value === "string"
    ? value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
    : [];
}

const characterFormSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  name: z.string().trim().min(1).max(160),
  type: z.string().trim().min(1).max(80),
  species: z.string().trim().max(120).optional(),
  narrativeDescription: z.string().trim().min(1).max(1000),
  identity: z.string().trim().min(1).max(2000),
});

export async function createCharacterAction(formData: FormData) {
  await requireParentMode();
  const values = characterFormSchema.extend({ id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) }).parse({
    id: formData.get("id"),
    name: formData.get("name"),
    type: formData.get("type"),
    species: formData.get("species") || undefined,
    narrativeDescription: formData.get("narrativeDescription"),
    identity: formData.get("identity"),
  });
  await createCharacter({
    ...values,
    palette: splitLines(formData.get("palette")),
    fixedTraits: splitLines(formData.get("fixedTraits")),
    doNotChange: splitLines(formData.get("doNotChange")),
  });
  revalidatePath("/parent/characters");
  redirect(`/parent/characters#character-${values.id}`);
}

export async function updateCharacterAction(characterId: string, formData: FormData) {
  await requireParentMode();
  const values = characterFormSchema.omit({ id: true }).parse({
    name: formData.get("name"),
    type: formData.get("type"),
    species: formData.get("species") || undefined,
    narrativeDescription: formData.get("narrativeDescription"),
    identity: formData.get("identity"),
  });
  await updateCharacter({
    characterId,
    ...values,
    palette: splitLines(formData.get("palette")),
    fixedTraits: splitLines(formData.get("fixedTraits")),
    doNotChange: splitLines(formData.get("doNotChange")),
  });
  revalidatePath("/parent/characters");
  revalidatePath("/parent/books");
}

export async function addCharacterReferenceAction(characterId: string, formData: FormData) {
  await requireParentMode();
  const image = formData.get("image");
  if (!(image instanceof File)) throw new Error("Reference image is required.");
  if (image.size === 0 || image.size > MAX_CHARACTER_REFERENCE_BYTES) throw new Error("Reference image must be between 1 byte and 5 MB.");
  const roleValue = formData.get("role");
  const role = typeof roleValue === "string" ? roleValue.trim() : "reference";
  await addCharacterReference({
    characterId,
    bytes: new Uint8Array(await image.arrayBuffer()),
    mimeType: image.type,
    role,
    makeIdentity: formData.get("makeIdentity") === "yes",
  });
  revalidatePath("/parent/characters");
}

export async function setCharacterIdentityReferenceAction(characterId: string, referenceId: string) {
  await requireParentMode();
  await setCharacterIdentityReference({ characterId, referenceId });
  revalidatePath("/parent/characters");
}

export async function updateCharacterReferenceRoleAction(
  characterId: string,
  referenceId: string,
  formData: FormData,
) {
  await requireParentMode();
  const role = z.string().trim().min(1).max(80).parse(formData.get("role"));
  await updateCharacterReferenceRole({ characterId, referenceId, role });
  revalidatePath("/parent/characters");
}

export async function removeCharacterReferenceAction(characterId: string, referenceId: string) {
  await requireParentMode();
  await removeCharacterReference({ characterId, referenceId });
  revalidatePath("/parent/characters");
}

export async function deleteCharacterAction(characterId: string, formData: FormData) {
  await requireParentMode();
  if (formData.get("confirm") !== "yes") throw new Error("Character deletion must be confirmed.");
  await deleteCharacter({ characterId });
  revalidatePath("/parent/characters");
  revalidatePath("/parent/books");
}
