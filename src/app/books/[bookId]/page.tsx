import { connection } from "next/server";
import { notFound } from "next/navigation";
import { BookReader } from "@/components/book-reader";
import { loadLibrary } from "@/lib/content/loader";

export default async function BookPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  await connection();
  const { bookId } = await params;
  const { books } = await loadLibrary();
  const book = books.find((item) => item.id === bookId && item.status === "ready");

  if (!book) {
    notFound();
  }

  return <BookReader book={book} />;
}
