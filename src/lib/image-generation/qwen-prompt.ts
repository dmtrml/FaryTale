import type { Book, BookPage, Character } from "../content/schemas";
import type { ReferencePackItem } from "./reference-pack";
import {
  composeChatEnvironmentPrompt,
  composeChatPagePrompt,
} from "../story/chat-image-prompt";

export const QWEN_DEFAULT_STEPS = 25;
export const QWEN_CHARACTER_REFERENCE_SIZE = { width: 1024, height: 1024 } as const;
export const QWEN_ENVIRONMENT_REFERENCE_SIZE = { width: 1024, height: 576 } as const;
export const QWEN_PAGE_SIZE = { width: 1920, height: 1080 } as const;

export const QWEN_BOOK_NEGATIVE_PROMPT = [
  "visible text",
  "letters",
  "numbers",
  "logo",
  "watermark",
  "decorative frame",
  "duplicate character",
  "accidental extra character",
  "extra limbs",
  "extra fingers",
  "deformed hands",
  "distorted face",
  "asymmetrical eyes",
  "blurry face",
  "cluttered background",
  "unrelated background action",
  "harsh dramatic shadows",
  "horror atmosphere",
  "adult glamour styling",
].join(", ");

export const QWEN_CHILD_IDENTITY_NEGATIVE_PROMPT = [
  QWEN_BOOK_NEGATIVE_PROMPT,
  "sad expression",
  "gloomy expression",
  "crying",
  "tears",
  "fear",
  "worried expression",
  "angry expression",
  "frown",
  "blank lifeless expression",
].join(", ");

export function isChildCharacter(character: Character) {
  const source = [
    character.type,
    character.species ?? "",
    character.narrativeDescription,
    character.visual.identity,
  ]
    .join(" ")
    .toLowerCase();
  return /child|toddler|baby|реб[её]н|малыш|девочк|мальчик/u.test(source);
}

export function composeQwenCharacterReferencePrompt(character: Character) {
  const child = isChildCharacter(character);
  const source = [
    "Character name: " + character.name,
    "Canonical identity source: " + character.visual.identity,
    character.visual.palette.length
      ? "Canonical palette source: " + character.visual.palette.join(", ")
      : "",
    character.visual.fixedTraits.length
      ? "Fixed-trait source: " + character.visual.fixedTraits.join("; ")
      : "",
    character.visual.doNotChange.length
      ? "Do-not-change source: " + character.visual.doNotChange.join("; ")
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  return [
    "Create one canonical character identity reference for a children's picture-book series.",
    "The canonical source fields below may contain Russian text. Interpret them as semantic design instructions; do not render that text inside the image.",
    source,
    child
      ? "Expression and mood: warm, calm, gently cheerful and emotionally safe. Use a small natural smile, bright attentive friendly eyes, relaxed eyebrows and a relaxed face. The expression should feel curious and content, not posed or exaggerated."
      : "Expression and mood: warm, calm, friendly and natural.",
    "Show exactly one character, centered and easy to inspect, in a clean three-quarter or full-body character-reference composition with simple negative space.",
    "Use a polished children's-book illustration style with soft natural light, rounded readable forms and restrained background detail.",
    "Preserve the exact identity traits, age impression, proportions, hair or fur colors, face structure and recurring clothing described in the canonical source.",
    "Do not add other characters, captions, labels, typography, logos, watermarks or frames.",
  ].join("\n");
}

export function composeQwenEnvironmentReferencePrompt(options: {
  book: Book;
  pagePrompts: Array<string | null>;
}) {
  const sourceBrief = composeChatEnvironmentPrompt(options);
  return [
    "Create one canonical environment reference for a children's picture book.",
    "Output composition: horizontal 16:9.",
    "Use the source brief below as semantic source data. It may contain Russian text; follow its meaning precisely and never render the source text as typography inside the image.",
    "SOURCE BRIEF:",
    sourceBrief,
    "END SOURCE BRIEF.",
    "This is an environment reference, not a story scene. Do not include characters.",
    "Show the recurring room or location and permanent objects clearly enough that layout, shape, scale, palette and materials can be repeated on future pages.",
    "Use a simple reference-friendly composition, soft readable lighting and minimal clutter.",
    "No visible text, letters, numbers, logos, watermarks or decorative frames.",
  ].join("\n");
}

export function composeQwenPagePrompt(options: {
  book: Book;
  page: BookPage;
  rawPrompt?: string | null;
  characters: Character[];
  referenceItems?: ReferencePackItem[];
  referencePrefix?: Array<{ label: string; instruction?: string }>;
}) {
  const sourceBrief = composeChatPagePrompt(options);
  const hasChild = options.characters.some(isChildCharacter);
  return [
    "Create one separate children's picture-book illustration.",
    "Output composition: horizontal 16:9. Create a single image, not a collage, storyboard or multi-panel layout.",
    "Use every attached reference image as a canonical visual constraint. Do not redesign identities, recurring environments or exact recurring objects.",
    hasChild
      ? "For child characters, keep the scene emotionally safe and age-appropriate. Unless the source scene explicitly requests another emotion, use a warm calm expression with a subtle natural smile and bright attentive eyes."
      : "",
    "Use the source brief below as semantic source data. It may contain Russian text; follow its meaning precisely and never render the source text as typography inside the image.",
    "SOURCE BRIEF:",
    sourceBrief,
    "END SOURCE BRIEF.",
    "Keep full visual continuity with the rest of the book: same character identity, recurring location, recurring objects, scale logic, palette and illustration style.",
    "No visible text, letters, numbers, logos, watermarks, decorative frames, accidental extra characters or unrelated background actions.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function composeQwenEditPrompt(options: {
  instruction: string;
  continuityPrompt: string;
}) {
  return [
    "Edit <image1>; do not create an unrelated new scene.",
    "Requested edit (source text; may be Russian): " + options.instruction.trim(),
    "Preserve composition, character identity, environment, style, lighting and every detail that the requested edit does not explicitly change.",
    options.continuityPrompt,
  ].join("\n");
}
