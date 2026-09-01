import { createDraftBookAction } from "@/app/parent/actions";

export default function NewBookPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#786f65]">Новый черновик</p>
      <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Создать книгу</h1>
      <p className="mt-3 max-w-2xl leading-7 text-[#70685e]">Создаётся только безопасная каноническая заготовка. AI для этого не нужен.</p>

      <form action={createDraftBookAction} className="mt-7 space-y-5 rounded-3xl border border-[#d8d0c5] bg-[#fffdf8] p-6 sm:p-8">
        <label className="block">
          <span className="text-sm font-semibold">Название</span>
          <input name="title" required maxLength={160} className="mt-2 min-h-12 w-full rounded-xl border border-[#d8d0c5] bg-white px-4" placeholder="Например: Мяу готовится ко сну" />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Цель истории</span>
          <textarea name="goalDescription" required maxLength={500} rows={4} className="mt-2 w-full rounded-xl border border-[#d8d0c5] bg-white p-4" placeholder="Что ребёнок должен увидеть или понять через действие?" />
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label>
            <span className="text-sm font-semibold">Страниц</span>
            <input name="pageCount" type="number" min="1" max="200" defaultValue="5" required className="mt-2 min-h-12 w-full rounded-xl border border-[#d8d0c5] bg-white px-4" />
          </label>
          <label>
            <span className="text-sm font-semibold">Возраст от, мес.</span>
            <input name="minMonths" type="number" min="0" max="144" defaultValue="18" required className="mt-2 min-h-12 w-full rounded-xl border border-[#d8d0c5] bg-white px-4" />
          </label>
          <label>
            <span className="text-sm font-semibold">Возраст до, мес.</span>
            <input name="maxMonths" type="number" min="0" max="144" defaultValue="24" required className="mt-2 min-h-12 w-full rounded-xl border border-[#d8d0c5] bg-white px-4" />
          </label>
        </div>
        <button type="submit" className="min-h-12 rounded-full bg-[#40382f] px-6 font-semibold text-white">Создать черновик</button>
      </form>
    </main>
  );
}
