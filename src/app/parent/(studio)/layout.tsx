import Link from "next/link";
import { exitParentMode } from "@/app/parent/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireParentMode } from "@/lib/parent/access";

export default async function ParentStudioLayout({ children }: { children: React.ReactNode }) {
  await requireParentMode();

  return (
    <div className="min-h-dvh bg-[#eee8dd] text-[#342f2a]">
      <header className="print-hidden border-b border-[#d8d0c5] bg-[#fffdf8]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5 py-4 sm:px-8">
          <Link href="/parent/books" className="mr-auto text-xl font-semibold">FaryTale · Родители</Link>
          <nav className="flex flex-wrap items-center gap-2 text-sm font-semibold" aria-label="Разделы для родителей">
            <Link className="rounded-full px-4 py-2 hover:bg-[#f0ece4]" href="/parent/books">Книги</Link>
            <Link className="rounded-full px-4 py-2 hover:bg-[#f0ece4]" href="/parent/characters">Персонажи</Link>
            <Link className="rounded-full px-4 py-2 hover:bg-[#f0ece4]" href="/parent/studio">Помощник</Link>
            <Link className="rounded-full bg-[#40382f] px-4 py-2 text-white" href="/parent/new">Новая книга</Link>
          </nav>
          <ThemeToggle />
          <form action={exitParentMode}>
            <button className="rounded-full border border-[#d8d0c5] px-4 py-2 text-sm font-semibold" type="submit">Выйти</button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
