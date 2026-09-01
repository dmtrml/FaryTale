import Link from "next/link";
import { redirect } from "next/navigation";
import { ParentEntryGate } from "@/components/parent-entry-gate";
import { hasParentMode } from "@/lib/parent/access";

export default async function ParentEntryPage() {
  if (await hasParentMode()) {
    redirect("/parent/books");
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-[#eee8dd] px-6 py-12">
      <section className="w-full max-w-xl rounded-[2rem] border border-[#d8d0c5] bg-[#fffdf8] p-8 text-center shadow-sm sm:p-10">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#e8decc] text-3xl">🔒</div>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Режим для родителей</h1>
        <p className="mx-auto mt-3 max-w-md leading-7 text-[#70685e]">
          Здесь можно менять тексты и иллюстрации. Чтобы ребёнок не открыл редактор случайно, удерживайте кнопку ниже.
        </p>
        <ParentEntryGate />
        <Link href="/" className="mt-6 inline-block px-4 py-2 text-sm font-semibold text-[#625a51] underline-offset-4 hover:underline">
          Вернуться к сказкам
        </Link>
      </section>
    </main>
  );
}
