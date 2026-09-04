import { StudioChat } from "@/components/studio-chat";

export default async function ParentStudioPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string }>;
}) {
  const { intent } = await searchParams;
  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#756d64]">Помощник для книг</p>
      <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Что хотите сделать?</h1>
      <p className="mt-3 max-w-3xl leading-7 text-[#70685e]">
        Можно описывать задачу обычными словами. Технические команды и формат хранения остаются внутри приложения.
      </p>
      <div className="mt-6">
        <StudioChat initialIntent={intent} />
      </div>
    </main>
  );
}
