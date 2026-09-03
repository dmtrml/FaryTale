import type { Character } from "@/lib/content/schemas";

function sentence(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /[.!?…]$/u.test(trimmed) ? trimmed : `${trimmed}.`;
}

function listItem(value: string) {
  return value.trim().replace(/[.!?…]+$/u, "");
}

export function composeCharacterGenerationPrompt(character: Character) {
  const parts = [
    `Создай каноническое изображение персонажа «${character.name}».`,
    sentence(character.visual.identity),
  ];

  if (character.visual.palette.length) {
    parts.push(sentence(`Цветовая палитра: ${character.visual.palette.join(", ")}`));
  }

  if (character.visual.fixedTraits.length) {
    parts.push(
      sentence(
        `Обязательно сохраняй эти неизменные признаки: ${character.visual.fixedTraits.map(listItem).join("; ")}`,
      ),
    );
  }

  if (character.visual.doNotChange.length) {
    parts.push(
      sentence(
        `Не изменяй следующие элементы: ${character.visual.doNotChange.map(listItem).join("; ")}`,
      ),
    );
  }

  parts.push(
    "Покажи одного персонажа крупно и ясно, без дополнительных персонажей. Без текста, букв, логотипов, рамок и водяных знаков.",
  );

  return parts.filter(Boolean).join(" ");
}
