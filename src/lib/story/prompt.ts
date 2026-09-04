import type { Book, Character } from "../content/schemas";
import type { AgeBandRule } from "./rules";
import { deriveBookVisualConsistency } from "./consistency";

export function composeIllustrationPrompt({
  book,
  pageNumber,
  beat,
  sceneBrief,
  pageText,
  environment,
  composition,
  continuityNotes,
  ageRule,
  characters,
}: {
  book: Book;
  pageNumber: number;
  beat: string;
  sceneBrief?: string;
  pageText?: string;
  environment?: string;
  composition?: string;
  continuityNotes?: string;
  ageRule: AgeBandRule;
  characters: Character[];
}) {
  const consistency = deriveBookVisualConsistency(book, characters);

  return `# Illustration prompt

## Scene
${sceneBrief?.trim() || beat}

${pageText !== undefined ? `Read-aloud text already approved for this page: “${pageText}”\nThe visible action must match that approved text; do not invent a different event.` : ""}

The illustration must visibly match page ${pageNumber} of “${book.title}”.

## Characters
${consistency.characterIdentity}

## Environment
${environment?.trim() || "Show only the room/location/props needed to make the main action immediately understandable. Avoid decorative clutter."}

## Composition
- Required aspect ratio: horizontal 16:9 for every page illustration.
- One dominant event and one clear action direction.
- ${ageRule.visualGuidance}
- Keep the hero and key object/action large and easy to find.
- Vary camera distance/pose from neighboring pages when possible; avoid passport/selfie framing.
${composition?.trim() ? `- Page-specific composition: ${composition.trim()}` : ""}

## Style lock
${consistency.styleLock}

## Continuity
${consistency.continuity}
${continuityNotes?.trim() ? `\n- Page-specific continuity note: ${continuityNotes.trim()}` : ""}

## Negative constraints
- No text, letters, logos, watermarks, UI, or decorative frame inside the illustration.
- No accidental extra characters.
- No duplicate limbs or confusing anatomy.
- No visually busy background action for toddler-oriented pages.
- Do not override canonical character identity with scene details.

## Generation metadata
- provider: manual
- model:
- generated_at:
- seed:
- reference_images:
${consistency.referencePaths.length ? consistency.referencePaths.map((reference) => `  - ${reference}`).join("\n") : "  - none"}

## Notes
- age_band: ${ageRule.id}
- text_guidance: ${ageRule.textGuidance}
- aspect_ratio: 16:9 landscape
`;
}
