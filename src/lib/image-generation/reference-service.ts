import {
  addCharacterReference,
  getCanonicalCharacter,
  replaceBookEnvironmentReference,
} from "../content/authoring";
import {
  getCanonicalBook,
  readBookPagePrompts,
} from "../content/mutations";
import { composeCharacterGenerationPrompt } from "../characters/prompt";
import { composeChatEnvironmentPrompt } from "../story/chat-image-prompt";
import type { ImageProvider } from "../providers/contracts";

type GenerateCharacterReferenceOptions = {
  characterId: string;
  provider: ImageProvider;
  contentRoot?: string;
};

type GenerateEnvironmentReferenceOptions = {
  bookId: string;
  provider: ImageProvider;
  contentRoot?: string;
};

function requireGeneratedResult(
  result: Awaited<ReturnType<ImageProvider["generate"]>>,
  label: string,
) {
  if (result.kind !== "generated") {
    throw new Error(`${label} requires a configured image provider that returns image bytes.`);
  }
  return result;
}

export async function generateCharacterIdentityReference({
  characterId,
  provider,
  contentRoot,
}: GenerateCharacterReferenceOptions) {
  const character = await getCanonicalCharacter(characterId, contentRoot);
  if (!character) throw new Error("Character not found.");

  const prompt = composeCharacterGenerationPrompt(character);
  const result = requireGeneratedResult(
    await provider.generate({
      mode: "generate",
      prompt,
      size: { width: 1024, height: 1024 },
    }),
    "Character reference generation",
  );
  const saved = await addCharacterReference({
    characterId,
    bytes: result.bytes,
    mimeType: result.mimeType,
    role: "reference",
    makeIdentity: true,
    contentRoot,
  });

  return {
    result,
    prompt,
    referenceId: saved.referenceId,
    relativePath: saved.relativePath,
  };
}

export async function generateBookEnvironmentReference({
  bookId,
  provider,
  contentRoot,
}: GenerateEnvironmentReferenceOptions) {
  const book = await getCanonicalBook(bookId, contentRoot);
  if (!book) throw new Error("Book not found or invalid.");
  const pagePrompts = await readBookPagePrompts({ bookId, contentRoot });
  const prompt = composeChatEnvironmentPrompt({ book, pagePrompts });
  const result = requireGeneratedResult(
    await provider.generate({
      mode: "generate",
      prompt,
      size: { width: 1024, height: 576 },
    }),
    "Environment reference generation",
  );
  const saved = await replaceBookEnvironmentReference({
    bookId,
    bytes: result.bytes,
    mimeType: result.mimeType,
    contentRoot,
  });

  return {
    result,
    prompt,
    relativePath: saved.relativePath,
  };
}
