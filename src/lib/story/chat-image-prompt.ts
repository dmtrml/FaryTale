import type { Book, BookPage, Character } from "../content/schemas";
import { selectCanonicalIdentityReference } from "../characters/identity";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function section(prompt: string | null | undefined, title: string) {
  if (!prompt) return "";
  const match = prompt.match(
    new RegExp(`(?:^|\\n)## ${escapeRegExp(title)}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`),
  );
  return match?.[1]?.trim() ?? "";
}

function firstParagraph(value: string) {
  return value.split(/\n\s*\n/)[0]?.trim() ?? "";
}

function pageSpecificLine(value: string, marker: string) {
  const line = value
    .split(/\r?\n/)
    .map((item) => item.replace(/^[-*]\s*/, "").trim())
    .find((item) => item.startsWith(marker));
  return line ? line.slice(marker.length).trim() : "";
}

function characterFallback(character: Character) {
  const rules = [
    ...character.visual.fixedTraits,
    ...character.visual.doNotChange,
  ].map((rule) => rule.trim().replace(/[.;]+$/g, ""));
  return `${character.name}: ${character.visual.identity.trim().replace(/\s+/g, " ")}${
    rules.length ? ` Сохраняй: ${rules.join("; ")}.` : ""
  }`;
}

function referenceWord(count: number) {
  if (count % 10 === 1 && count % 100 !== 11) return "референс";
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return "референса";
  return "референсов";
}

function referencePlan(book: Book, characters: Character[]) {
  const characterReferences = characters
    .map((character) => ({ character, reference: selectCanonicalIdentityReference(character) }))
    .filter((item): item is { character: Character; reference: NonNullable<typeof item.reference> } => Boolean(item.reference));
  const environmentReference = book.references.find((reference) => reference.role === "environment") ?? null;

  const items: string[] = [];
  characterReferences.forEach(({ character }, index) => {
    items.push(`референс ${index + 1} — каноническая внешность персонажа ${character.name}`);
  });
  if (environmentReference) {
    items.push(`референс ${items.length + 1} — каноническое окружение, художественный стиль и постоянные предметы книги`);
  }

  return {
    characterReferences,
    environmentReference,
    instruction: items.length
      ? `Я прикладываю ${items.length} ${referenceWord(items.length)}: ${items.join("; ")}. Используй их как канонические и не переосмысливай внешность персонажей, окружение и постоянные предметы от страницы к странице.`
      : "Визуальные референсы пока не приложены, поэтому строго следуй текстовым описаниям и сохраняй одни и те же внешность, стиль и постоянные предметы на всех страницах.",
  };
}

function pageScene(page: BookPage, rawPrompt?: string | null) {
  return firstParagraph(section(rawPrompt, "Scene")) || page.text || `Сцена страницы ${page.number}.`;
}

function pageDetails(rawPrompt?: string | null) {
  const environment = section(rawPrompt, "Environment");
  const composition = pageSpecificLine(section(rawPrompt, "Composition"), "Page-specific composition:");
  const continuity = pageSpecificLine(section(rawPrompt, "Continuity"), "Page-specific continuity note:");
  const style = section(rawPrompt, "Style lock");
  return { environment, composition, continuity, style };
}

function commonVisualInstruction(book: Book, characters: Character[]) {
  const plan = referencePlan(book, characters);
  const withoutReference = characters.filter(
    (character) => !plan.characterReferences.some((item) => item.character.id === character.id),
  );
  const fallback = withoutReference.length
    ? ` Для персонажей без изображения-референса используй это каноническое описание: ${withoutReference.map(characterFallback).join(" ")}`
    : "";
  return `${plan.instruction}${fallback}`;
}

export function composeChatPagePrompt({
  book,
  page,
  rawPrompt,
  characters,
}: {
  book: Book;
  page: BookPage;
  rawPrompt?: string | null;
  characters: Character[];
}) {
  const details = pageDetails(rawPrompt);
  const parts = [
    `Создай одну отдельную иллюстрацию для страницы ${page.number} детской книги «${book.title}».`,
    commonVisualInstruction(book, characters),
    `Сцена: ${pageScene(page, rawPrompt)}`,
    details.environment ? `Окружение: ${details.environment}` : "",
    details.composition ? `Композиция: ${details.composition}` : "Композиция простая: один главный момент, герой и ключевой объект крупные, действие понятно без текста, минимум визуального шума.",
    details.continuity ? `Дополнительная непрерывность: ${details.continuity}` : "",
    details.style ? `Художественный стиль: ${details.style}` : "",
    "Сохраняй полную визуальную консистентность с остальными страницами книги. Не добавляй текст, буквы, цифры, логотипы, водяные знаки, рамки, случайных дополнительных персонажей или лишние фоновые действия.",
  ];
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

export function composeChatBookPrompt({
  book,
  characters,
  pagePrompts,
}: {
  book: Book;
  characters: Character[];
  pagePrompts: Array<string | null>;
}) {
  const firstStyle = pagePrompts.map((prompt) => section(prompt, "Style lock")).find(Boolean);
  const header = [
    `Создай серию из ${book.pages.length} отдельных иллюстраций для одной детской книги «${book.title}».`,
    `Мне нужны именно ${book.pages.length} отдельных изображений, по одному изображению на каждую страницу, в порядке от страницы 1 до страницы ${book.pages.length}. Не объединяй сцены в коллаж, раскадровку или одну общую картинку.`,
    commonVisualInstruction(book, characters),
    "Все изображения должны выглядеть как страницы одной и той же книги: сохраняй одинаковую внешность персонажей, одну и ту же комнату/локацию там, где она повторяется, одинаковый дизайн постоянных предметов, масштаб, цветовую логику и художественный стиль.",
    firstStyle ? `Общий художественный стиль: ${firstStyle}` : "",
    "На изображениях не должно быть текста, букв, цифр, логотипов, водяных знаков, декоративных рамок или случайных дополнительных персонажей.",
  ].filter(Boolean).join(" ");

  const pages = book.pages.map((page, index) => {
    const rawPrompt = pagePrompts[index];
    const details = pageDetails(rawPrompt);
    const pageParts = [
      `СТРАНИЦА ${page.number}.`,
      `Сцена: ${pageScene(page, rawPrompt)}`,
      details.environment ? `Окружение: ${details.environment}` : "",
      details.composition ? `Композиция: ${details.composition}` : "",
      details.continuity ? `Непрерывность: ${details.continuity}` : "",
    ];
    return pageParts.filter(Boolean).join(" ");
  });

  return `${header}\n\n${pages.join("\n\n")}`;
}
