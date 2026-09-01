import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { loadLibrary } from "@/lib/content/loader";

export default async function PrintableBookPage({ params }: { params: Promise<{ bookId: string }> }) {
  await connection();
  const { bookId } = await params;
  const { books } = await loadLibrary();
  const book = books.find((item) => item.id === bookId);
  if (!book) notFound();

  return (
    <main className="print-root mx-auto max-w-4xl bg-white px-5 py-8 text-[#2d2925] sm:px-8">
      <div className="print-hidden mb-8 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/parent/books/${book.id}`} className="text-sm font-semibold underline">← Редактор книги</Link>
        <PrintButton />
      </div>
      <header className="print-page grid min-h-[80vh] place-items-center text-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#756d64]">{book.age.label}</p>
          <h1 className="mt-4 text-5xl font-semibold leading-tight">{book.title}</h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-[#625a51]">{book.goal.description}</p>
        </div>
      </header>
      {book.pages.map((page) => (
        <section key={page.number} className="print-page grid min-h-[95vh] content-center gap-7 py-8">
          {page.image ? (
            <Image
              unoptimized
              width={1200}
              height={1200}
              src={`/api/parent/books/${book.id}/asset?path=${encodeURIComponent(page.image)}`}
              alt={`Иллюстрация страницы ${page.number}: ${page.text}`}
              className="mx-auto max-h-[70vh] w-full rounded-2xl object-contain"
            />
          ) : (
            <div className="grid aspect-square place-items-center rounded-2xl border border-dashed border-[#cfc5b8] text-[#756d64]">Иллюстрация отсутствует</div>
          )}
          <p className="mx-auto max-w-2xl text-center text-2xl leading-10">{page.text}</p>
          <p className="text-center text-xs text-[#8a8177]">{page.number} / {book.pages.length}</p>
        </section>
      ))}
    </main>
  );
}
