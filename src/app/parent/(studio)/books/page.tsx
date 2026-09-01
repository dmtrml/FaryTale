import Link from "next/link";
import { connection } from "next/server";
import { loadLibrary } from "@/lib/content/loader";

export default async function ParentBooksPage() {
  await connection();
  const { books, diagnostics } = await loadLibrary();

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#786f65]">Канонические файлы</p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Книги</h1>
        </div>
        <Link href="/" className="text-sm font-semibold underline">Открыть детскую полку</Link>
      </div>

      {diagnostics.length > 0 ? (
        <aside className="mt-6 rounded-2xl border border-[#d8bcae] bg-[#fff7f1] p-5">
          <h2 className="font-semibold">Диагностика контента: {diagnostics.length}</h2>
          <ul className="mt-2 space-y-1 text-sm text-[#715d52]">
            {diagnostics.slice(0, 5).map((item, index) => (
              <li key={`${item.source}-${item.code}-${index}`}>{item.severity}: {item.message}</li>
            ))}
          </ul>
        </aside>
      ) : null}

      <form action="/api/parent/import" method="post" encType="multipart/form-data" className="mt-6 rounded-2xl border border-[#d8d0c5] bg-[#fffdf8] p-5">
        <label htmlFor="book-package" className="font-semibold">Восстановить книгу из FaryTale ZIP</label>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input id="book-package" name="package" type="file" accept=".zip,application/zip" required className="max-w-full text-sm" />
          <button type="submit" className="rounded-full border border-[#d8d0c5] bg-white px-5 py-2.5 text-sm font-semibold">Проверить и импортировать</button>
        </div>
        <p className="mt-2 text-xs text-[#756d64]">Пакет полностью валидируется до записи книги. Максимум 100 МБ; существующая книга с тем же id не перезаписывается.</p>
      </form>

      <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {books.map((book) => (
          <Link key={book.id} href={`/parent/books/${book.id}`} className="rounded-3xl border border-[#d8d0c5] bg-[#fffdf8] p-6 shadow-sm transition-transform active:scale-[0.99]">
            <div className="flex items-center justify-between gap-3 text-sm text-[#756d64]">
              <span>{book.age.label}</span>
              <span className="rounded-full bg-[#eee8dd] px-3 py-1 font-semibold">{book.status}</span>
            </div>
            <h2 className="mt-5 text-2xl font-semibold leading-tight">{book.title}</h2>
            <p className="mt-3 line-clamp-3 leading-6 text-[#70685e]">{book.goal.description}</p>
            <p className="mt-5 text-sm font-semibold">{book.pages.length} страниц →</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
