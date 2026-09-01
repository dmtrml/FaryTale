import { StudioChat } from "@/components/studio-chat";

export default function ParentStudioPage() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#756d64]">Parent-only · tool-driven</p>
      <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">AI Studio</h1>
      <p className="mt-3 max-w-3xl leading-7 text-[#70685e]">
        Чат — только интерфейс. Каноническое состояние всегда записывается в файлы книг и персонажей; история чата не является источником правды.
      </p>
      <div className="mt-6">
        <StudioChat />
      </div>
    </main>
  );
}
