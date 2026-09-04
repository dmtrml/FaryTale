import type { AgeBand, StoryPattern } from "../content/schemas";

export type AgeBandRule = {
  id: AgeBand;
  minMonths: number;
  maxMonths: number;
  textGuidance: string;
  visualGuidance: string;
};

// Runtime reflection of skills/childrens-story-creator/age-rules.md.
// The Markdown skill remains the authoring source of truth; this small typed
// representation makes deterministic/manual workflows possible in the app.
export const ageBandRules: AgeBandRule[] = [
  {
    id: "12-18m",
    minMonths: 12,
    maxMonths: 18,
    textGuidance: "2–6 spoken words per page; one concrete action.",
    visualGuidance: "One main action, large familiar objects, minimal clutter.",
  },
  {
    id: "18-24m",
    minMonths: 18,
    maxMonths: 24,
    textGuidance: "3–10 words per page; one short sentence, simple verbs and nouns.",
    visualGuidance: "Action readable without text; hero and key object dominant.",
  },
  {
    id: "2-3y",
    minMonths: 24,
    maxMonths: 36,
    textGuidance: "1–2 short sentences per page with clear cause and effect.",
    visualGuidance: "One dominant event with a little contextual detail.",
  },
  {
    id: "4-5y",
    minMonths: 48,
    maxMonths: 60,
    textGuidance: "1–3 short sentences; broader vocabulary with context.",
    visualGuidance: "Richer environment, readable interaction, action first.",
  },
  {
    id: "6-8y",
    minMonths: 72,
    maxMonths: 96,
    textGuidance: "Richer prose and reasoning without lecturing.",
    visualGuidance: "More cinematic composition and environmental storytelling allowed.",
  },
];

export function selectAgeBand(minMonths: number, maxMonths: number): AgeBandRule {
  const midpoint = (minMonths + maxMonths) / 2;
  const direct = ageBandRules.find(
    (rule) => midpoint >= rule.minMonths && midpoint <= rule.maxMonths,
  );
  if (direct) return direct;

  return [...ageBandRules].sort((a, b) => {
    const distanceA = Math.abs(midpoint - (a.minMonths + a.maxMonths) / 2);
    const distanceB = Math.abs(midpoint - (b.minMonths + b.maxMonths) / 2);
    return distanceA - distanceB || a.minMonths - b.minMonths;
  })[0] as AgeBandRule;
}

export const storyPatternLabels: Record<StoryPattern, string> = {
  "habit-routine": "Привычка / рутина",
  "independence-trying": "Самостоятельность / проба",
  "emotion-regulation": "Эмоция / успокоение",
  "fear-new-situation": "Страх / новая ситуация",
  "safety-rule": "Правило безопасности",
  "social-skill": "Социальный навык",
  "curiosity-explanation": "Любопытство / объяснение",
  "family-memory": "Семейное воспоминание",
};

const patternKeywords: Array<{ pattern: StoryPattern; words: string[] }> = [
  {
    pattern: "habit-routine",
    words: [
      "habit",
      "routine",
      "wash",
      "brush",
      "sequence",
      "ritual",
      "убир",
      "мыть",
      "умы",
      "рутин",
      "ритуал",
      "привыч",
      "последователь",
      "горш",
      "туалет",
      "зуб",
      "щет",
      "щёт",
      "волос",
      "прич",
      "расчес",
      "расчёс",
      "одев",
    ],
  },
  { pattern: "independence-trying", words: ["independ", "try", "самостоят", "сам ", "попроб"] },
  {
    pattern: "emotion-regulation",
    words: ["emotion", "angry", "anger", "sad", "frustrat", "эмоц", "злит", "груст", "сердит", "расстро"],
  },
  { pattern: "fear-new-situation", words: ["fear", "doctor", "dentist", "боится", "страх", "врач", "стомат"] },
  { pattern: "safety-rule", words: ["safety", "road", "hot", "опас", "безопас", "дорог", "горяч"] },
  { pattern: "social-skill", words: ["share", "turn-taking", "social", "делиться", "очеред", "просить"] },
  { pattern: "curiosity-explanation", words: ["why", "explain", "science", "почему", "объяс", "как устро"] },
  { pattern: "family-memory", words: ["memory", "family", "real event", "воспомин", "семейн", "реальн"] },
];

export function recommendStoryPattern(goalType: string, description: string): StoryPattern {
  const haystack = `${goalType} ${description}`.toLowerCase();
  const directByType: Record<string, StoryPattern> = {
    habit: "habit-routine",
    routine: "habit-routine",
    independence: "independence-trying",
    emotion: "emotion-regulation",
    fear: "fear-new-situation",
    safety: "safety-rule",
    social: "social-skill",
    curiosity: "curiosity-explanation",
    explanation: "curiosity-explanation",
    memory: "family-memory",
  };
  if (directByType[goalType.toLowerCase()]) return directByType[goalType.toLowerCase()];

  return (
    patternKeywords.find(({ words }) => words.some((word) => haystack.includes(word)))?.pattern ??
    "habit-routine"
  );
}

export const storyPatternBeats: Record<StoryPattern, string[]> = {
  "habit-routine": [
    "Показать знакомое занятие до перехода к рутине.",
    "Показать понятный сигнал, что пора перейти к нужному действию.",
    "Персонаж начинает нужное действие без стыда и угроз.",
    "Крупно и ясно показать главное действие в процессе.",
    "Показать, что действие завершено.",
    "Показать практический положительный результат и спокойное завершение.",
  ],
  "independence-trying": [
    "Персонаж хочет попробовать сделать простое дело сам.",
    "Показать первую конкретную попытку.",
    "Возникает небольшая понятная трудность.",
    "Персонаж получает немного помощи или пробует иначе.",
    "Показать успех или частичный успех без требования идеальности.",
    "Тёпло отметить усилие и завершить сцену спокойно.",
  ],
  "emotion-regulation": [
    "Показать ясную и безопасную ситуацию, которая вызывает чувство.",
    "Показать чувство через лицо, позу и действие.",
    "Просто назвать чувство, не называя его плохим.",
    "Показать безопасную поддерживающую реакцию или действие.",
    "Показать, как тело и действие постепенно успокаиваются.",
    "Закончить восстановлением контакта и чувства безопасности.",
  ],
  "fear-new-situation": [
    "Правдиво показать новую ситуацию без драматизации.",
    "Персонаж немного сомневается или тревожится.",
    "Показать конкретно, что будет происходить дальше.",
    "Показать предсказуемую поддержку или способ справиться.",
    "Новая ситуация происходит спокойно и без лишнего напряжения.",
    "Показать безопасное завершение без обещаний, которые нельзя гарантировать.",
  ],
  "safety-rule": [
    "Начать с обычной безопасной ситуации.",
    "Показать понятный сигнал опасности без привлекательной демонстрации риска.",
    "Показать простое безопасное правило через действие.",
    "Показать поддержку взрослого, если она нужна по возрасту.",
    "Показать безопасный практический результат.",
    "Повторить правило через безопасное действие, а не лекцию.",
  ],
  "social-skill": [
    "Показать двух персонажей с простой общей потребностью или желанием.",
    "Возникает мягкое узнаваемое социальное напряжение.",
    "Показать одну простую фразу или действие-навык.",
    "Другой персонаж понятно отвечает.",
    "Оба продолжают занятие положительно.",
    "Закончить без стыда, наказания или морализаторства.",
  ],
  "curiosity-explanation": [
    "Персонаж замечает конкретное явление.",
    "Возникает простой конкретный вопрос.",
    "Показать наблюдение или исследование.",
    "Дать простое точное объяснение через сцену.",
    "Показать ещё один понятный пример того же принципа.",
    "Закончить удовлетворяющим наблюдением или открытием.",
  ],
  "family-memory": [
    "Начать в реальном месте и времени воспоминания.",
    "Показать конкретную семейную или сенсорную деталь.",
    "Продолжить реальную последовательность событий без придуманного конфликта.",
    "Выделить правдивый жест связи или запомнившийся момент.",
    "Показать ещё одну реальную деталь события.",
    "Закончить конкретным запомнившимся образом.",
  ],
};

export function fitBeatsToPageCount(pattern: StoryPattern, pageCount: number) {
  const beats = storyPatternBeats[pattern];
  if (pageCount === beats.length) return [...beats];
  if (pageCount <= 1) return [beats[beats.length - 1] as string];
  if (pageCount < beats.length) {
    return Array.from({ length: pageCount }, (_, index) => {
      const sourceIndex = Math.round((index * (beats.length - 1)) / (pageCount - 1));
      return beats[sourceIndex] as string;
    });
  }

  const result = [...beats];
  while (result.length < pageCount) {
    result.splice(result.length - 1, 0, "Повторить ключевое действие в новом, но таком же понятном примере.");
  }
  return result;
}
