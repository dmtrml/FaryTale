import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { loadLibrary } from "@/lib/content/loader";
import { ChildLibraryShelf } from "@/components/child-library-shelf";

function LibraryLoading() {
  return (
    <div className="grid gap-5 sm:grid-cols-2" aria-label="Загрузка библиотеки">
      {[0, 1].map((item) => (
        <div
          key={item}
          className="min-h-72 animate-pulse rounded-[2rem] border border-[var(--border)] bg-[var(--surface)]"
        />
      ))}
    </div>
  );
}

async function LibraryShelf() {
  await connection();
  const { books, characters } = await loadLibrary();
  const visibleBooks = books.filter((book) => book.status === "ready");
  const characterNames = Object.fromEntries(characters.map((character) => [character.id, character.name]));

  if (visibleBooks.length === 0) {
    return (
      <section className="rounded-[2rem] border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-16 text-center">
        <div className="mx-auto mb-5 grid size-20 place-items-center rounded-full bg-[#efe5d3] text-4xl">
          📚
        </div>
        <h2 className="text-2xl font-semibold">Полка пока пустая</h2>
        <p className="mx-auto mt-3 max-w-md leading-7 text-[var(--muted)]">
          Когда появится первая история, она будет ждать здесь.
        </p>
      </section>
    );
  }

  return <ChildLibraryShelf books={visibleBooks} characterNames={characterNames} />;
}

export default function Home() {
  return (
    <main className="min-h-screen px-5 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 sm:mb-10">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid size-12 place-items-center rounded-2xl bg-[#eadbbf] text-2xl shadow-sm">
                ✨
              </div>
              <span className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                FaryTale
              </span>
            </div>
            <Link
              href="/parent"
              className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--muted)] shadow-sm transition-colors hover:text-[var(--foreground)]"
            >
              Для родителей
            </Link>
          </div>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Наши сказки
          </h1>
          <p className="mt-3 max-w-2xl text-lg leading-8 text-[var(--muted)]">
            Выберите знакомую историю и устройтесь поудобнее.
          </p>
        </header>

        <Suspense fallback={<LibraryLoading />}>
          <LibraryShelf />
        </Suspense>
      </div>
    </main>
  );
}
