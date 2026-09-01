import type { Book, Character } from "../content/schemas";
import {
  canonicalCharacterContinuityLines,
  canonicalCharacterIdentityLine,
  selectCanonicalIdentityReference,
} from "../characters/identity";

export function deriveBookVisualConsistency(book: Book, characters: Character[]) {
  return {
    styleLock:
      book.authoring?.visualStyle?.trim() ||
      "No explicit book-level style lock is recorded yet. Preserve already-approved book/character references and do not redesign recurring identities.",
    characterIdentity:
      characters.length > 0
        ? characters.map(canonicalCharacterIdentityLine).join("\n")
        : "- No recurring character selected yet. Do not invent a canonical identity lock.",
    continuity:
      characters.length > 0
        ? characters.flatMap(canonicalCharacterContinuityLines).join("\n")
        : "- Keep any later-approved recurring identity consistent across pages.",
    referencePaths: characters.flatMap((character) => {
      const reference = selectCanonicalIdentityReference(character);
      return reference
        ? [`../../../characters/${character.id}/${reference.path}`]
        : [];
    }),
  };
}
