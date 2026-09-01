import Link from "next/link";
import Image from "next/image";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import {
  deletePageAction,
  duplicatePageAction,
  generatePageImageAction,
  insertPageAction,
  movePageAction,
  prepareStoryDraftAction,
  replaceBookCoverAction,
  replacePageImageAction,
  updateBookMetadataAction,
  updatePageCharactersAction,
  updatePageTextAction,
} from "@/app/parent/actions";
import { CopyPromptButton } from "@/components/copy-prompt-button";
import { loadLibrary } from "@/lib/content/loader";
import { inspectBookPageImage, readBookPagePrompt } from "@/lib/content/mutations";
import { storyPatternLabels, recommendStoryPattern } from "@/lib/story/rules";
import { getServerProviderConfig } from "@/lib/providers/server-config";
import { assessIllustrationPrompt } from "@/lib/story/quality";
import { listBookPageImageHistory } from "@/lib/image-generation/service";

const bookStatuses = [
  ["draft", "Черновик"],
  ["text_ready", "Текст готов"],
  ["prompt_ready", "Промпты готовы"],
  ["illustrating", "Иллюстрируется"],
  ["ready", "Готова для ребёнка"],
  ["archived", "Архив"],
] as const;

export default async function ParentBookPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  await connection();
  const { bookId } = await params;
  const query = await searchParams;
  const { books, characters } = await loadLibrary();
  const book = books.find((item) => item.id === bookId);
  if (!book) notFound();

  const requestedPage = Number.parseInt(query.page ?? "1", 10);
  const pageNumber = Number.isFinite(requestedPage)
    ? Math.min(Math.max(requestedPage, 1), book.pages.length)
    : 1;
  const page = book.pages[pageNumber - 1];
  if (!page) notFound();

  const [prompt, imageInspection, history] = await Promise.all([
    readBookPagePrompt({ bookId, pageNumber }),
    inspectBookPageImage({ bookId, pageNumber }),
    listBookPageImageHistory({ bookId, pageNumber }),
  ]);
  const pageCharacters = characters.filter((character) => page.characters.includes(character.id));
  const promptIssues = prompt ? assessIllustrationPrompt(prompt, pageCharacters) : [];
  const latestPreviousImage = history[0];
  const prepareStory = prepareStoryDraftAction.bind(null, book.id);
  const updateMetadata = updateBookMetadataAction.bind(null, book.id);
  const replaceCover = replaceBookCoverAction.bind(null, book.id);
  const updateText = updatePageTextAction.bind(null, book.id, page.number);
  const updatePageCharacters = updatePageCharactersAction.bind(null, book.id, page.number);
  const replaceImage = replacePageImageAction.bind(null, book.id, page.number);
  const generateImage = generatePageImageAction.bind(null, book.id, page.number);
  const duplicatePage = duplicatePageAction.bind(null, book.id, page.number);
  const deletePage = deletePageAction.bind(null, book.id, page.number);
  const movePage = movePageAction.bind(null, book.id, page.number);
  const insertPage = insertPageAction.bind(null, book.id);
  const recommendedPattern = recommendStoryPattern(book.goal.type, book.goal.description);
  const providerConfig = getServerProviderConfig();
  const networkImageProvider = providerConfig.FARYTALE_IMAGE_PROVIDER !== "manual";
  const currentBeat = book.authoring?.outline[pageNumber - 1]?.beat;

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
      <Link href="/parent/books" className="text-sm font-semibold underline">← Все книги</Link>

      <section className="mt-5 rounded-3xl border border-[#d8d0c5] bg-[#fffdf8] p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#756d64]">{book.id} · {book.pages.length} стр.</p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">{book.title}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {book.status === "ready" ? (
              <Link href={`/books/${book.id}`} className="rounded-full border border-[#d8d0c5] px-4 py-2 text-sm font-semibold">Открыть как ребёнок</Link>
            ) : (
              <span className="rounded-full bg-[#eee8dd] px-4 py-2 text-sm font-semibold text-[#756d64]">Reader появится после статуса ready</span>
            )}
            <Link href={`/parent/books/${book.id}/print`} className="rounded-full border border-[#d8d0c5] px-4 py-2 text-sm font-semibold">Печать / PDF</Link>
            <a href={`/api/parent/books/${book.id}/export`} className="rounded-full border border-[#d8d0c5] px-4 py-2 text-sm font-semibold">Экспорт ZIP</a>
          </div>
        </div>

        <form action={updateMetadata} className="mt-7 grid gap-4 border-t border-[#e4ddd3] pt-6 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="text-sm font-semibold">Название</span>
            <input name="title" required maxLength={160} defaultValue={book.title} className="mt-2 min-h-12 w-full rounded-xl border border-[#d8d0c5] bg-white px-4" />
          </label>
          <label>
            <span className="text-sm font-semibold">Язык</span>
            <input name="language" required minLength={2} maxLength={35} defaultValue={book.language} className="mt-2 min-h-12 w-full rounded-xl border border-[#d8d0c5] bg-white px-4" placeholder="ru" />
          </label>
          <div className="hidden sm:block" />
          <label className="sm:col-span-2">
            <span className="text-sm font-semibold">Цель книги</span>
            <textarea name="goalDescription" required maxLength={500} rows={3} defaultValue={book.goal.description} className="mt-2 w-full rounded-xl border border-[#d8d0c5] bg-white p-4" />
          </label>
          <label>
            <span className="text-sm font-semibold">Возраст от, мес.</span>
            <input name="minMonths" type="number" min="0" max="144" defaultValue={book.age.minMonths} required className="mt-2 min-h-12 w-full rounded-xl border border-[#d8d0c5] bg-white px-4" />
          </label>
          <label>
            <span className="text-sm font-semibold">Возраст до, мес.</span>
            <input name="maxMonths" type="number" min="0" max="144" defaultValue={book.age.maxMonths} required className="mt-2 min-h-12 w-full rounded-xl border border-[#d8d0c5] bg-white px-4" />
          </label>
          <label>
            <span className="text-sm font-semibold">Статус книги</span>
            <select name="status" defaultValue={book.status} className="mt-2 min-h-12 w-full rounded-xl border border-[#d8d0c5] bg-white px-3">
              {bookStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            <span className="text-sm font-semibold">Персонажи книги</span>
            <select name="characterIds" multiple defaultValue={book.characters} className="mt-2 h-28 w-full rounded-xl border border-[#d8d0c5] bg-white px-3 py-2">
              {characters.map((character) => <option key={character.id} value={character.id}>{character.name} ({character.id})</option>)}
            </select>
            <span className="mt-1 block text-xs text-[#756d64]">Ctrl/Cmd — выбрать несколько. Удаление персонажа из книги также убирает его со страниц.</span>
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="rounded-full bg-[#40382f] px-5 py-2.5 text-sm font-semibold text-white">Сохранить книгу</button>
          </div>
        </form>

        <div className="mt-6 border-t border-[#e4ddd3] pt-6">
          <h2 className="text-lg font-semibold">Обложка</h2>
          <div className="mt-3 flex flex-wrap items-start gap-5">
            {book.cover ? (
              <Image
                unoptimized
                width={480}
                height={640}
                src={`/api/parent/books/${book.id}/asset?path=${encodeURIComponent(book.cover)}`}
                alt={`Обложка книги ${book.title}`}
                className="max-h-64 w-auto max-w-48 rounded-2xl bg-[#f4f0e9] object-contain"
              />
            ) : <div className="flex h-48 w-36 items-center justify-center rounded-2xl bg-[#f4f0e9] text-center text-xs text-[#756d64]">Обложки пока нет</div>}
            <form action={replaceCover} className="min-w-0 flex-1 rounded-2xl bg-[#f4f0e9] p-4">
              <label className="text-sm font-semibold" htmlFor="book-cover">Загрузить / заменить обложку</label>
              <input id="book-cover" name="image" type="file" required accept="image/png,image/jpeg,image/webp,image/avif,image/gif" className="mt-3 block max-w-full text-sm" />
              <button className="mt-3 rounded-full border border-[#d8d0c5] bg-white px-4 py-2 text-sm font-semibold">Сохранить обложку</button>
              <p className="mt-2 text-xs text-[#756d64]">PNG, JPEG, WebP, AVIF или GIF · до 5 МБ.</p>
            </form>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-[#cfc5b8] bg-[#f8f4ed] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#786f65]">Навигация по большой книге</p>
            <h2 className="mt-1 text-xl font-semibold">Страница {pageNumber} из {book.pages.length}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {pageNumber > 1 ? <Link href={`?page=${pageNumber - 1}`} className="rounded-full border border-[#d8d0c5] bg-white px-4 py-2 text-sm font-semibold">← Предыдущая</Link> : null}
            <form method="get" className="flex items-center gap-2">
              <label className="text-sm font-semibold" htmlFor="jump-page">Перейти</label>
              <select id="jump-page" name="page" defaultValue={String(pageNumber)} className="min-h-10 rounded-xl border border-[#d8d0c5] bg-white px-3">
                {book.pages.map((item) => <option key={item.number} value={item.number}>{item.number}</option>)}
              </select>
              <button className="rounded-full border border-[#d8d0c5] bg-white px-3 py-2 text-sm font-semibold">Открыть</button>
            </form>
            {pageNumber < book.pages.length ? <Link href={`?page=${pageNumber + 1}`} className="rounded-full border border-[#d8d0c5] bg-white px-4 py-2 text-sm font-semibold">Следующая →</Link> : null}
          </div>
        </div>

        <div className="mt-4 grid gap-3 border-t border-[#ded5ca] pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <form action={insertPage}>
            <input type="hidden" name="position" value={pageNumber} />
            <button className="min-h-11 w-full rounded-xl border border-[#d8d0c5] bg-white px-3 text-sm font-semibold">+ Вставить перед</button>
          </form>
          <form action={insertPage}>
            <input type="hidden" name="position" value={pageNumber + 1} />
            <button className="min-h-11 w-full rounded-xl border border-[#d8d0c5] bg-white px-3 text-sm font-semibold">+ Вставить после</button>
          </form>
          <form action={duplicatePage}>
            <button className="min-h-11 w-full rounded-xl border border-[#d8d0c5] bg-white px-3 text-sm font-semibold">Дублировать</button>
          </form>
          <form action={movePage} className="flex gap-2">
            <input name="targetPosition" type="number" min="1" max={book.pages.length} defaultValue={pageNumber} aria-label="Новая позиция страницы" className="min-h-11 min-w-0 flex-1 rounded-xl border border-[#d8d0c5] bg-white px-3" />
            <button className="rounded-xl border border-[#d8d0c5] bg-white px-3 text-sm font-semibold">Переместить</button>
          </form>
        </div>
        {book.pages.length > 1 ? (
          <form action={deletePage} className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl bg-[#f7e8e2] p-3">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="confirm" value="yes" required /> Подтверждаю удаление страницы {pageNumber}</label>
            <button className="rounded-full border border-[#b87666] bg-white px-4 py-2 text-sm font-semibold text-[#8a493b]">Удалить страницу</button>
            <span className="text-xs text-[#756d64]">Её текущие image/prompt assets будут перенесены в архив книги.</span>
          </form>
        ) : null}
      </section>

      <article className="mt-6 rounded-3xl border border-[#d8d0c5] bg-[#fffdf8] p-6 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold">Редактор страницы {page.number}</h2>
          <div className="flex flex-wrap gap-2 text-sm font-semibold">
            <span className="rounded-full bg-[#eee8dd] px-3 py-1">Иллюстрация: {page.imageStatus}</span>
            {imageInspection ? <span className="rounded-full bg-[#e5efe7] px-3 py-1">{imageInspection.width}×{imageInspection.height}</span> : null}
            {prompt ? <span className={`rounded-full px-3 py-1 ${promptIssues.length ? "bg-[#f4dfd8]" : "bg-[#e5efe7]"}`}>Prompt: {promptIssues.length ? `${promptIssues.length} замеч.` : "OK"}</span> : null}
          </div>
        </div>

        {page.image ? (
          <figure className="mt-5 max-w-xl rounded-2xl bg-[#f4f0e9] p-3">
            <Image unoptimized width={1024} height={1024} className="aspect-square w-full rounded-xl object-contain" src={`/api/parent/books/${book.id}/asset?path=${encodeURIComponent(page.image)}`} alt={`Иллюстрация страницы ${page.number}`} />
            <figcaption className="mt-2 text-xs font-semibold text-[#756d64]">Текущая иллюстрация</figcaption>
          </figure>
        ) : null}

        {page.image && latestPreviousImage ? (
          <details className="mt-4 rounded-2xl bg-[#f4f0e9] p-4">
            <summary className="cursor-pointer text-sm font-semibold">Показать предыдущую версию иллюстрации</summary>
            <Image unoptimized width={1024} height={1024} className="mt-3 aspect-square w-full max-w-xl rounded-xl object-contain" src={`/api/parent/books/${book.id}/history?path=${encodeURIComponent(latestPreviousImage)}`} alt={`Предыдущая иллюстрация страницы ${page.number}`} />
          </details>
        ) : null}

        <form action={updateText} className="mt-5">
          <label className="text-sm font-semibold" htmlFor={`page-${page.number}-text`}>Текст страницы</label>
          <textarea id={`page-${page.number}-text`} name="text" defaultValue={page.text} rows={5} maxLength={2000} className="mt-2 w-full rounded-2xl border border-[#d8d0c5] bg-white p-4 leading-7 outline-none focus:border-[#625a51]" />
          <button type="submit" className="mt-3 rounded-full bg-[#40382f] px-5 py-2.5 text-sm font-semibold text-white">Сохранить текст</button>
        </form>

        <form action={updatePageCharacters} className="mt-6 border-t border-[#e4ddd3] pt-5">
          <label className="text-sm font-semibold">Персонажи на этой странице</label>
          <div className="mt-3 flex flex-wrap gap-2">
            {characters.length ? characters.map((character) => (
              <label key={character.id} className="flex items-center gap-2 rounded-full border border-[#d8d0c5] bg-white px-3 py-2 text-sm">
                <input type="checkbox" name="characterIds" value={character.id} defaultChecked={page.characters.includes(character.id)} />
                {character.name}
              </label>
            )) : <span className="text-sm text-[#756d64]">Сначала создайте персонажа в разделе «Персонажи».</span>}
          </div>
          <button type="submit" className="mt-3 rounded-full border border-[#d8d0c5] bg-white px-5 py-2.5 text-sm font-semibold">Сохранить персонажей страницы</button>
        </form>

        <form action={replaceImage} className="mt-6 border-t border-[#e4ddd3] pt-5">
          <label className="text-sm font-semibold" htmlFor={`page-${page.number}-image`}>Заменить / добавить иллюстрацию</label>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input id={`page-${page.number}-image`} name="image" type="file" accept="image/png,image/jpeg,image/webp,image/avif,image/gif" required className="max-w-full text-sm" />
            <button type="submit" className="rounded-full border border-[#d8d0c5] bg-white px-5 py-2.5 text-sm font-semibold">Загрузить</button>
          </div>
          <p className="mt-2 text-xs text-[#756d64]">PNG, JPEG, WebP, AVIF или GIF · до 5 МБ.</p>
        </form>

        <div className="mt-6 border-t border-[#e4ddd3] pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Промпт иллюстрации</h3>
            {prompt ? <CopyPromptButton text={prompt} /> : null}
          </div>
          {currentBeat ? <p className="mt-2 text-xs text-[#756d64]"><strong>Beat:</strong> {currentBeat}</p> : null}
          {prompt ? (
            <>
              <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-2xl bg-[#f4f0e9] p-4 text-sm leading-6">{prompt}</pre>
              {networkImageProvider ? (
                <form action={generateImage} className="mt-3">
                  <button type="submit" className="rounded-full bg-[#40382f] px-5 py-2.5 text-sm font-semibold text-white">{page.imageStatus === "failed" || page.imageStatus === "ready" ? "Сгенерировать заново" : "Сгенерировать иллюстрацию"}</button>
                  <p className="mt-2 text-xs text-[#756d64]">Генерируется только эта страница через {providerConfig.FARYTALE_IMAGE_PROVIDER}.</p>
                </form>
              ) : <p className="mt-3 text-xs text-[#756d64]">Image provider: manual. Промпт готов для ручной генерации или загрузки изображения.</p>}
              {promptIssues.length ? <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-[#8a493b]">{promptIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : null}
            </>
          ) : <p className="mt-3 text-sm text-[#756d64]">Промпт ещё не создан.</p>}
        </div>
      </article>

      <section className="mt-6 rounded-3xl border border-[#cfc5b8] bg-[#f8f4ed] p-6 sm:p-7">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#786f65]">Story skill · без AI</p>
        <h2 className="mt-2 text-2xl font-semibold">Пересобрать структуру и промпты</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#70685e]">Работает для всей текущей длины книги. Текст страниц не перезаписывается.</p>
        <form action={prepareStory} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label>
            <span className="text-sm font-semibold">Story pattern</span>
            <select name="storyPattern" defaultValue={book.authoring?.storyPattern ?? recommendedPattern} className="mt-2 min-h-12 w-full rounded-xl border border-[#d8d0c5] bg-white px-3">
              {Object.entries(storyPatternLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            <span className="text-sm font-semibold">Главный персонаж</span>
            <select name="characterId" defaultValue={book.characters[0] ?? ""} className="mt-2 min-h-12 w-full rounded-xl border border-[#d8d0c5] bg-white px-3">
              <option value="">Без выбранного канонического персонажа</option>
              {characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}
            </select>
          </label>
          <label className="sm:col-span-2">
            <span className="text-sm font-semibold">Style lock (необязательно)</span>
            <input name="visualStyle" defaultValue={book.authoring?.visualStyle ?? ""} maxLength={600} className="mt-2 min-h-12 w-full rounded-xl border border-[#d8d0c5] bg-white px-4" />
          </label>
          <div className="sm:col-span-2"><button type="submit" className="rounded-full bg-[#40382f] px-5 py-2.5 text-sm font-semibold text-white">Подготовить структуру и промпты</button></div>
        </form>
        {book.authoring ? <p className="mt-4 text-xs text-[#756d64]">Текущая структура: {book.authoring.outline.length} beats · {storyPatternLabels[book.authoring.storyPattern]} · {book.authoring.ageBand}</p> : null}
      </section>
    </main>
  );
}
