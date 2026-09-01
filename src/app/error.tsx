"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center px-6 py-12">
      <section className="max-w-lg rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 grid size-20 place-items-center rounded-full bg-[#efe5d3] text-4xl">
          📖
        </div>
        <h1 className="text-2xl font-semibold">Не получилось открыть полку</h1>
        <p className="mt-3 leading-7 text-[var(--muted)]">
          Попробуйте открыть библиотеку ещё раз.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 min-h-12 rounded-full bg-[#40382f] px-6 py-3 font-semibold text-white"
        >
          Попробовать снова
        </button>
      </section>
    </main>
  );
}
