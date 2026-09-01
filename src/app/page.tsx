import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { loadLibrary } from "@/lib/content/loader";

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
  const { books } = await loadLibrary();
  const visibleBooks = books.filter((book) => book.status === "ready");

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

  return (
    <section className="grid gap-5 sm:grid-cols-2" aria-label="Книги">
      {visibleBooks.map((book, index) => (
        <Link
          key={book.id}
          href={`/books/${book.id}`}
          className="group overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] shadow-[0_18px_60px_rgba(77,62,43,0.08)] transition-transform focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#6f675d] active:scale-[0.99]"
          aria-label={`Открыть книгу «${book.title}»`}
        >
          <div
            className={`flex min-h-56 items-end p-7 ${
              index % 2 === 0
                ? "bg-[linear-gradient(145deg,#dcebdd,#f7e8c8)]"
                : "bg-[linear-gradient(145deg,#dbe7f3,#f4dfd3)]"
            }`}
          >
            <div className="grid size-20 place-items-center rounded-[1.6rem] bg-white/75 text-4xl shadow-sm backdrop-blur-sm">
              {index % 2 === 0 ? "🐾" : "🧸"}
            </div>
          </div>

          <div className="p-7">
            <div className="flex flex-wrap gap-2 text-sm font-medium text-[var(--muted)]">
              <span className="rounded-full bg-[#f0ece4] px-3 py-1.5">
                {book.age.label}
              </span>
              <span className="rounded-full bg-[#f0ece4] px-3 py-1.5">
                {book.pages.length} стр.
              </span>
            </div>
            <h2 className="mt-5 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
              {book.title}
            </h2>
            <p className="mt-3 line-clamp-2 leading-7 text-[var(--muted)]">
              {book.goal.description}
            </p>
          </div>
        </Link>
      ))}
    </section>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen px-5 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 sm:mb-10">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-[#eadbbf] text-2xl shadow-sm">
              ✨
            </div>
            <span className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              FaryTale
            </span>
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

        <footer className="mt-10 text-center">
          <Link
            href="/parent"
            className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-[#756d64] underline-offset-4 hover:underline"
          >
            Для родителей
          </Link>
        </footer>
      </div>
    </main>
  );
}
