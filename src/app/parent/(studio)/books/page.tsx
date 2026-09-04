import Link from "next/link";
import { connection } from "next/server";
import { loadLibrary } from "@/lib/content/loader";
import { ParentBookLibrary } from "@/components/parent-book-library";

export default async function ParentBooksPage() {
  await connection();
  const { books, characters, diagnostics } = await loadLibrary();
  const characterNames = Object.fromEntries(characters.map((character) => [character.id, character.name]));

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#786f65]">Моя библиотека</p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Книги</h1>
        </div>
        <Link href="/" className="text-sm font-semibold underline">Открыть детскую полку</Link>
      </div>

      {diagnostics.length > 0 ? (
        <aside className="mt-6 rounded-2xl border border-[#d8bcae] bg-[#fff7f1] p-5">
          <h2 className="font-semibold">Найдены проблемы с файлами: {diagnostics.length}</h2>
          <ul className="mt-2 space-y-1 text-sm text-[#715d52]">
            {diagnostics.slice(0, 5).map((item, index) => (
              <li key={`${item.source}-${item.code}-${index}`}>{item.severity}: {item.message}</li>
            ))}
          </ul>
        </aside>
      ) : null}

      <ParentBookLibrary books={books} characterNames={characterNames} />

      <details className="mt-8 rounded-2xl border border-[#d8d0c5] bg-[#fffdf8] p-4">
        <summary className="cursor-pointer text-sm font-semibold">Технические инструменты</summary>
        <form action="/api/parent/import" method="post" encType="multipart/form-data" className="mt-4 border-t border-[#e4ddd3] pt-4">
          <label htmlFor="book-package" className="font-semibold">Восстановить книгу из FaryTale ZIP</label>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input id="book-package" name="package" type="file" accept=".zip,application/zip" required className="max-w-full text-sm" />
            <button type="submit" className="rounded-full border border-[#d8d0c5] bg-white px-5 py-2.5 text-sm font-semibold">Проверить и импортировать</button>
          </div>
          <p className="mt-2 text-xs text-[#756d64]">Пакет полностью валидируется до записи книги. Максимум 100 МБ; существующая книга с тем же id не перезаписывается.</p>
        </form>
      </details>
    </main>
  );
}
