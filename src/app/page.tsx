import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { loadLibrary } from "@/lib/content/loader";
import { ChildLibraryShelf } from "@/components/child-library-shelf";

function LibraryLoading() {
  return (
    <div
      className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4"
      aria-label="Загрузка библиотеки"
    >
      {[0, 1, 2, 3].map((item) => (
        <div
          key={item}
          className="aspect-[4/3] animate-pulse rounded-[1.4rem] border border-[var(--border)] bg-[var(--surface)]"
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
    <main className="min-h-screen px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-[#eadbbf] text-xl shadow-sm">
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
        </header>

        <Suspense fallback={<LibraryLoading />}>
          <LibraryShelf />
        </Suspense>
      </div>
    </main>
  );
}
