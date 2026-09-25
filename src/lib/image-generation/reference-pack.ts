import type { Book, Character } from "../content/schemas";
import { selectCanonicalIdentityReference } from "../characters/identity";

export const MAX_QWEN_REFERENCE_IMAGES = 10;

export type ReferencePackKind = "character" | "environment" | "book" | "external";

export type ReferencePackItem = {
  kind: ReferencePackKind;
  id: string;
  label: string;
  instruction?: string;
  role: string;
  storage?: {
    scope: "character" | "book";
    ownerId: string;
    relativePath: string;
    providerPath: string;
  };
};

export type AvailableReferencePackItem = ReferencePackItem & {
  storage: NonNullable<ReferencePackItem["storage"]>;
};

export function buildReferencePackPlan({
  book,
  characters,
}: {
  book: Book;
  characters: Character[];
}): ReferencePackItem[] {
  const items: ReferencePackItem[] = [];

  for (const character of characters) {
    const reference = selectCanonicalIdentityReference(character);
    if (!reference) continue;
    items.push({
      kind: "character",
      id: character.id,
      label: `каноническая внешность персонажа ${character.name}`,
      role: reference.role,
      storage: {
        scope: "character",
        ownerId: character.id,
        relativePath: reference.path,
        providerPath: `characters/${character.id}/${reference.path}`,
      },
    });
  }

  const environment = book.references.find((reference) => reference.role === "environment");
  if (environment) {
    items.push({
      kind: "environment",
      id: environment.id,
      label: "каноническое окружение, художественный стиль и постоянные предметы книги",
      role: environment.role,
      storage: {
        scope: "book",
        ownerId: book.id,
        relativePath: environment.path,
        providerPath: `books/${book.id}/${environment.path}`,
      },
    });
  }

  for (const reference of book.references) {
    if (reference.role === "environment" || reference.role === "external") continue;
    items.push({
      kind: "book",
      id: reference.id,
      label: `дополнительный канонический референс книги «${reference.id}»`,
      role: reference.role,
      storage: {
        scope: "book",
        ownerId: book.id,
        relativePath: reference.path,
        providerPath: `books/${book.id}/${reference.path}`,
      },
    });
  }

  for (const declaration of book.authoring?.externalReferences ?? []) {
    const stored = book.references.find(
      (reference) => reference.role === "external" && reference.id === declaration.id,
    );
    items.push({
      kind: "external",
      id: declaration.id,
      label: declaration.label,
      ...(declaration.instruction ? { instruction: declaration.instruction } : {}),
      role: "external",
      ...(stored
        ? {
            storage: {
              scope: "book" as const,
              ownerId: book.id,
              relativePath: stored.path,
              providerPath: `books/${book.id}/${stored.path}`,
            },
          }
        : {}),
    });
  }

  return items;
}

export function availableReferencePackItems(items: ReferencePackItem[]) {
  return items.filter(
    (item): item is AvailableReferencePackItem => Boolean(item.storage),
  );
}

export function assertQwenReferenceLimit(
  items: ReferencePackItem[],
  reservedImageSlots = 0,
): AvailableReferencePackItem[] {
  const available = availableReferencePackItems(items);
  if (
    reservedImageSlots < 0 ||
    !Number.isInteger(reservedImageSlots) ||
    reservedImageSlots > MAX_QWEN_REFERENCE_IMAGES
  ) {
    throw new Error("Invalid reserved image-slot count.");
  }
  if (available.length + reservedImageSlots > MAX_QWEN_REFERENCE_IMAGES) {
    throw new Error(
      `This request would submit ${available.length + reservedImageSlots} images; Qwen-Image-2.1 supports at most ${MAX_QWEN_REFERENCE_IMAGES}. Remove or consolidate references before generating.`,
    );
  }
  return available;
}
