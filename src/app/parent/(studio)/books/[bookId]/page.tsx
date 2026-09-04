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
  replaceBookEnvironmentReferenceAction,
  replacePageImageAction,
  updateBookMetadataAction,
  updatePageCharactersAction,
  updatePageTextAction,
} from "@/app/parent/actions";
import { CopyPromptButton } from "@/components/copy-prompt-button";
import { loadLibrary } from "@/lib/content/loader";
import { readBookPagePrompts } from "@/lib/content/mutations";
import { storyPatternLabels, recommendStoryPattern } from "@/lib/story/rules";
import { getServerProviderConfig } from "@/lib/providers/server-config";
import { assessIllustrationPrompt } from "@/lib/story/quality";
import { selectCanonicalIdentityReference } from "@/lib/characters/identity";
import {
  composeChatBookPrompt,
  composeChatEnvironmentPrompt,
  composeChatPagePrompt,
  usesPageByPageManualImageMode,
} from "@/lib/story/chat-image-prompt";

const bookStatuses = [
  ["draft", "Черновик"],
  ["text_ready", "Текст готов"],
  ["prompt_ready", "Промпты готовы"],
  ["illustrating", "Иллюстрируется"],
  ["ready", "Готова для ребёнка"],
  ["archived", "Архив"],
] as const;

function statusLabel(status: string) {
  return bookStatuses.find(([value]) => value === status)?.[1] ?? status;
}

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

  const requestedPage = Number.parseInt(query.page ?? "", 10);
  const selectedPageNumber =
    Number.isFinite(requestedPage) && requestedPage >= 1 && requestedPage <= book.pages.length
      ? requestedPage
      : null;

  const pagePrompts = await readBookPagePrompts({ bookId });
  const bookCharacters = characters.filter((character) => book.characters.includes(character.id));
  const environmentReference = book.references.find((reference) => reference.role === "environment") ?? null;
  const wholeBookPrompt = composeChatBookPrompt({ book, characters: bookCharacters, pagePrompts });
  const environmentPrompt = composeChatEnvironmentPrompt({ book, pagePrompts });
  const pageByPageOnly = usesPageByPageManualImageMode(book);
  const recommendedPattern = recommendStoryPattern(book.goal.type, book.goal.description);
  const providerConfig = getServerProviderConfig();
  const networkImageProvider = providerConfig.FARYTALE_IMAGE_PROVIDER !== "manual";
  const readyImageCount = book.pages.filter((page) => page.imageStatus === "ready" && page.image).length;

  const prepareStory = prepareStoryDraftAction.bind(null, book.id);
  const updateMetadata = updateBookMetadataAction.bind(null, book.id);
  const replaceCover = replaceBookCoverAction.bind(null, book.id);
  const replaceEnvironmentReference = replaceBookEnvironmentReferenceAction.bind(null, book.id);
  const appendPage = insertPageAction.bind(null, book.id);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
      <Link href="/parent/books" className="text-sm font-semibold underline">← Все книги</Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-[#d8d0c5] bg-[#fffdf8] p-5 sm:p-6">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#756d64]">{book.pages.length} стр. · {statusLabel(book.status)}</p>
          <h1 className="mt-1 truncate text-3xl font-semibold sm:text-4xl">{book.title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {book.status === "ready" ? (
            <Link href={`/books/${book.id}`} className="rounded-full bg-[#40382f] px-4 py-2 text-sm font-semibold text-white">Открыть как ребёнок</Link>
          ) : (
            <span className="rounded-full bg-[#eee8dd] px-4 py-2 text-sm font-semibold text-[#756d64]">Не опубликована</span>
          )}
          <Link href={`/parent/books/${book.id}/print`} className="rounded-full border border-[#d8d0c5] px-4 py-2 text-sm font-semibold">Печать / PDF</Link>
          <a href={`/api/parent/books/${book.id}/export`} className="rounded-full border border-[#d8d0c5] px-4 py-2 text-sm font-semibold">Экспорт ZIP</a>
        </div>
      </header>

      <details className="mt-4 overflow-hidden rounded-2xl border border-[#d8d0c5] bg-[#fffdf8]">
        <summary className="flex cursor-pointer list-none items-center gap-4 p-4 [&::-webkit-details-marker]:hidden">
          {book.cover ? (
            <Image
              unoptimized
              width={72}
              height={88}
              src={`/api/parent/books/${book.id}/asset?path=${encodeURIComponent(book.cover)}`}
              alt={`Обложка книги ${book.title}`}
              className="h-16 w-12 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-lg bg-[#eee8dd] text-xl">📕</div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">Книга и обложка</h2>
            <p className="mt-1 truncate text-sm text-[#756d64]">{book.title} · {book.age.label} · {statusLabel(book.status)}</p>
          </div>
          <span className="text-sm font-semibold text-[#756d64]">Настроить ↓</span>
        </summary>

        <div className="grid gap-6 border-t border-[#e4ddd3] p-4 sm:p-5 lg:grid-cols-[1fr_280px]">
          <form action={updateMetadata} className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="text-sm font-semibold">Название</span>
              <input name="title" required maxLength={160} defaultValue={book.title} className="mt-2 min-h-11 w-full rounded-xl border border-[#d8d0c5] bg-white px-4" />
            </label>
            <label>
              <span className="text-sm font-semibold">Статус</span>
              <select name="status" defaultValue={book.status} className="mt-2 min-h-11 w-full rounded-xl border border-[#d8d0c5] bg-white px-3">
                {bookStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              <span className="text-sm font-semibold">Язык</span>
              <input name="language" required minLength={2} maxLength={35} defaultValue={book.language} className="mt-2 min-h-11 w-full rounded-xl border border-[#d8d0c5] bg-white px-4" />
            </label>
            <label>
              <span className="text-sm font-semibold">Возраст от, мес.</span>
              <input name="minMonths" type="number" min="0" max="144" defaultValue={book.age.minMonths} required className="mt-2 min-h-11 w-full rounded-xl border border-[#d8d0c5] bg-white px-4" />
            </label>
            <label>
              <span className="text-sm font-semibold">Возраст до, мес.</span>
              <input name="maxMonths" type="number" min="0" max="144" defaultValue={book.age.maxMonths} required className="mt-2 min-h-11 w-full rounded-xl border border-[#d8d0c5] bg-white px-4" />
            </label>
            <label className="sm:col-span-2">
              <span className="text-sm font-semibold">Цель книги</span>
              <textarea name="goalDescription" required maxLength={500} rows={2} defaultValue={book.goal.description} className="mt-2 w-full rounded-xl border border-[#d8d0c5] bg-white p-3" />
            </label>
            <label className="sm:col-span-2">
              <span className="text-sm font-semibold">Персонажи книги</span>
              <select name="characterIds" multiple defaultValue={book.characters} className="mt-2 h-24 w-full rounded-xl border border-[#d8d0c5] bg-white px-3 py-2">
                {characters.map((character) => <option key={character.id} value={character.id}>{character.name} ({character.id})</option>)}
              </select>
            </label>
            <div className="sm:col-span-2">
              <button type="submit" className="rounded-full bg-[#40382f] px-5 py-2.5 text-sm font-semibold text-white">Сохранить настройки</button>
            </div>
          </form>

          <div className="rounded-2xl bg-[#f4f0e9] p-4">
            <h3 className="font-semibold">Обложка</h3>
            {book.cover ? (
              <Image
                unoptimized
                width={480}
                height={640}
                src={`/api/parent/books/${book.id}/asset?path=${encodeURIComponent(book.cover)}`}
                alt={`Обложка книги ${book.title}`}
                className="mt-3 aspect-[3/4] w-full rounded-xl bg-white object-contain"
              />
            ) : (
              <div className="mt-3 flex aspect-[3/4] items-center justify-center rounded-xl border border-dashed border-[#cfc5b8] bg-white text-sm text-[#756d64]">Обложки пока нет</div>
            )}
            <form action={replaceCover} className="mt-3">
              <input name="image" type="file" required accept="image/png,image/jpeg,image/webp,image/avif,image/gif" className="block w-full text-sm" />
              <button className="mt-3 w-full rounded-xl border border-[#d8d0c5] bg-white px-4 py-2 text-sm font-semibold">{book.cover ? "Заменить обложку" : "Загрузить обложку"}</button>
            </form>
          </div>
        </div>
      </details>

      <details className="mt-4 overflow-hidden rounded-2xl border border-[#d8d0c5] bg-[#fffdf8]">
        <summary className="flex cursor-pointer list-none items-center gap-4 p-4 [&::-webkit-details-marker]:hidden">
          <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#f4f0e9] text-2xl">🎨</div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">Иллюстрации и референсы</h2>
            <p className="mt-1 text-sm text-[#756d64]">{readyImageCount}/{book.pages.length} иллюстраций готово · формат 16:9 · {environmentReference ? "окружение загружено" : "окружение не загружено"}</p>
          </div>
          <span className="text-sm font-semibold text-[#756d64]">Открыть ↓</span>
        </summary>

        <div className="border-t border-[#e4ddd3] p-4 sm:p-5">
          <div className="flex flex-wrap gap-2">
            {pageByPageOnly ? null : <CopyPromptButton text={wholeBookPrompt} label="Скопировать промпт всей книги" />}
            <CopyPromptButton text={environmentPrompt} label="Скопировать промпт окружения" />
          </div>

          {pageByPageOnly ? (
            <div className="mt-3 rounded-xl border border-[#d8d0c5] bg-[#f4f0e9] p-3 text-sm leading-6 text-[#5f574f]">
              Для этой книги генерируйте иллюстрации по одной странице. Общий шестисценный промпт отключён, чтобы не объединять чувствительный бытовой контекст в одном запросе.
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl bg-[#f4f0e9] p-4">
              <h3 className="text-sm font-semibold">Персонажи</h3>
              <div className="mt-3 flex flex-wrap gap-3">
                {bookCharacters.map((character) => {
                  const reference = selectCanonicalIdentityReference(character);
                  return (
                    <div key={character.id} className="flex items-center gap-3 rounded-xl bg-white p-2 pr-4">
                      {reference ? (
                        <Image unoptimized width={64} height={64} src={`/api/parent/characters/${character.id}/asset?path=${encodeURIComponent(reference.path)}`} alt={`Референс ${character.name}`} className="size-14 rounded-lg object-contain" />
                      ) : <div className="grid size-14 place-items-center rounded-lg bg-[#eee8dd]">?</div>}
                      <div>
                        <p className="text-sm font-semibold">{character.name}</p>
                        <p className="text-xs text-[#756d64]">{reference ? "Главный референс ✓" : "Нет референса"}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl bg-[#f4f0e9] p-4">
              <h3 className="text-sm font-semibold">Окружение и постоянные предметы</h3>
              <div className="mt-3 flex items-start gap-3">
                {environmentReference ? (
                  <Image unoptimized width={96} height={96} src={`/api/parent/books/${book.id}/asset?path=${encodeURIComponent(environmentReference.path)}`} alt="Референс окружения" className="size-20 shrink-0 rounded-lg bg-white object-contain" />
                ) : <div className="grid size-20 shrink-0 place-items-center rounded-lg border border-dashed border-[#cfc5b8] bg-white text-xs text-[#756d64]">Нет фото</div>}
                <form action={replaceEnvironmentReference} className="min-w-0 flex-1">
                  <input name="image" type="file" required accept="image/png,image/jpeg,image/webp,image/avif,image/gif" className="block w-full text-sm" />
                  <button className="mt-2 rounded-xl border border-[#d8d0c5] bg-white px-4 py-2 text-sm font-semibold">{environmentReference ? "Заменить" : "Загрузить"}</button>
                  <p className="mt-2 text-xs text-[#756d64]">Только горизонтальный формат 16:9.</p>
                </form>
              </div>
            </div>
          </div>

          {pageByPageOnly ? null : (
            <details className="mt-4 rounded-xl bg-[#f4f0e9] p-3">
              <summary className="cursor-pointer text-sm font-semibold">Посмотреть общий промпт всей книги</summary>
              <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-white p-4 text-sm leading-6">{wholeBookPrompt}</pre>
            </details>
          )}
        </div>
      </details>

      <section className="mt-5 rounded-3xl border border-[#cfc5b8] bg-[#f8f4ed] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">Страницы</h2>
            <p className="mt-1 text-sm text-[#756d64]">Все страницы видны сразу. Нажмите на строку, чтобы открыть редактирование и промпт.</p>
          </div>
          <form action={appendPage}>
            <input type="hidden" name="position" value={book.pages.length + 1} />
            <button className="rounded-full border border-[#d8d0c5] bg-white px-4 py-2 text-sm font-semibold">+ Добавить страницу</button>
          </form>
        </div>

        <div className="mt-4 space-y-2">
          {book.pages.map((page, index) => {
            const prompt = pagePrompts[index] ?? null;
            const isSelected = selectedPageNumber === page.number;
            const pageCharacters = isSelected
              ? characters.filter((character) => page.characters.includes(character.id))
              : [];
            const chatPagePrompt = isSelected && prompt
              ? composeChatPagePrompt({ book, page, rawPrompt: prompt, characters: pageCharacters })
              : null;
            const promptIssues = isSelected && prompt ? assessIllustrationPrompt(prompt, pageCharacters) : [];
            const currentBeat = isSelected ? book.authoring?.outline[index]?.beat : undefined;
            const updateText = updatePageTextAction.bind(null, book.id, page.number);
            const updatePageCharacters = updatePageCharactersAction.bind(null, book.id, page.number);
            const replaceImage = replacePageImageAction.bind(null, book.id, page.number);
            const generateImage = generatePageImageAction.bind(null, book.id, page.number);
            const duplicatePage = duplicatePageAction.bind(null, book.id, page.number);
            const deletePage = deletePageAction.bind(null, book.id, page.number);
            const movePage = movePageAction.bind(null, book.id, page.number);
            const insertPage = insertPageAction.bind(null, book.id);

            return (
              <div key={page.number} id={`page-${page.number}`} className="overflow-hidden rounded-2xl border border-[#d8d0c5] bg-[#fffdf8]">
                <Link
                  href={isSelected ? `/parent/books/${book.id}#page-${page.number}` : `?page=${page.number}#page-${page.number}`}
                  className="flex items-center gap-3 p-3 sm:gap-4"
                >
                  <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-[#eee8dd] sm:size-24">
                    {page.image ? (
                      <Image unoptimized width={128} height={128} src={`/api/parent/books/${book.id}/asset?path=${encodeURIComponent(page.image)}`} alt={`Страница ${page.number}`} className="size-full object-cover" />
                    ) : (
                      <div className="grid size-full place-items-center text-2xl text-[#9b9186]">{page.number}</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#786f65]">Страница {page.number}</span>
                      <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${page.image ? "bg-[#e5efe7]" : "bg-[#eee8dd]"}`}>{page.image ? "Иллюстрация ✓" : "Без иллюстрации"}</span>
                      {prompt ? <span className="rounded-full bg-[#e5efe7] px-2 py-1 text-[11px] font-semibold">Промпт ✓</span> : null}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-medium leading-5 sm:text-base">{page.text || "Без текста"}</p>
                  </div>
                  <span className="hidden shrink-0 text-sm font-semibold text-[#756d64] sm:block">{isSelected ? "Свернуть ↑" : "Редактировать ↓"}</span>
                </Link>

                {isSelected ? (
                  <div className="border-t border-[#e4ddd3] p-4 sm:p-5">
                    <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
                      <div>
                        <div className="aspect-video overflow-hidden rounded-2xl bg-[#f4f0e9]">
                          {page.image ? (
                            <Image unoptimized width={512} height={512} src={`/api/parent/books/${book.id}/asset?path=${encodeURIComponent(page.image)}`} alt={`Иллюстрация страницы ${page.number}`} className="size-full object-contain" />
                          ) : <div className="grid size-full place-items-center text-sm text-[#756d64]">Иллюстрации пока нет</div>}
                        </div>
                        <form action={replaceImage} className="mt-3 rounded-xl bg-[#f4f0e9] p-3">
                          <label className="text-xs font-semibold">Загрузить иллюстрацию</label>
                          <input name="image" type="file" accept="image/png,image/jpeg,image/webp,image/avif,image/gif" required className="mt-2 block w-full text-xs" />
                          <button type="submit" className="mt-2 w-full rounded-xl border border-[#d8d0c5] bg-white px-3 py-2 text-sm font-semibold">{page.image ? "Заменить" : "Загрузить"}</button>
                          <p className="mt-2 text-[11px] text-[#756d64]">Формат страницы: 16:9.</p>
                        </form>
                      </div>

                      <div className="min-w-0">
                        <form action={updateText}>
                          <label className="text-sm font-semibold" htmlFor={`page-${page.number}-text`}>Текст страницы</label>
                          <textarea id={`page-${page.number}-text`} name="text" defaultValue={page.text} rows={3} maxLength={2000} className="mt-2 w-full rounded-xl border border-[#d8d0c5] bg-white p-3 leading-6" />
                          <button type="submit" className="mt-2 rounded-full bg-[#40382f] px-4 py-2 text-sm font-semibold text-white">Сохранить текст</button>
                        </form>

                        <div className="mt-5 border-t border-[#e4ddd3] pt-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#786f65]">Для ChatGPT Image</p>
                              <h3 className="mt-1 font-semibold">Промпт страницы</h3>
                            </div>
                            {chatPagePrompt ? <CopyPromptButton text={chatPagePrompt} label="Скопировать промпт" /> : null}
                          </div>
                          {chatPagePrompt ? (
                            <details className="mt-3 rounded-xl bg-[#f4f0e9] p-3">
                              <summary className="cursor-pointer text-sm font-semibold">Посмотреть готовый промпт</summary>
                              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-white p-3 text-sm leading-6">{chatPagePrompt}</pre>
                            </details>
                          ) : <p className="mt-2 text-sm text-[#756d64]">Промпт ещё не создан.</p>}
                          {networkImageProvider && chatPagePrompt ? (
                            <form action={generateImage} className="mt-3">
                              <button type="submit" className="rounded-full border border-[#d8d0c5] bg-white px-4 py-2 text-sm font-semibold">{page.imageStatus === "ready" ? "Сгенерировать заново" : "Сгенерировать иллюстрацию"}</button>
                            </form>
                          ) : null}
                        </div>

                        <details className="mt-4 rounded-xl border border-[#e4ddd3] bg-white p-3">
                          <summary className="cursor-pointer text-sm font-semibold">Персонажи страницы</summary>
                          <form action={updatePageCharacters} className="mt-3">
                            <div className="flex flex-wrap gap-2">
                              {characters.map((character) => (
                                <label key={character.id} className="flex items-center gap-2 rounded-full border border-[#d8d0c5] px-3 py-2 text-sm">
                                  <input type="checkbox" name="characterIds" value={character.id} defaultChecked={page.characters.includes(character.id)} />
                                  {character.name}
                                </label>
                              ))}
                            </div>
                            <button type="submit" className="mt-3 rounded-full border border-[#d8d0c5] px-4 py-2 text-sm font-semibold">Сохранить персонажей</button>
                          </form>
                        </details>

                        {prompt ? (
                          <details className="mt-3 rounded-xl border border-[#e4ddd3] bg-white p-3">
                            <summary className="cursor-pointer text-sm font-semibold">Техническая структура промпта</summary>
                            {currentBeat ? <p className="mt-3 text-xs text-[#756d64]"><strong>Beat:</strong> {currentBeat}</p> : null}
                            <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-[#f4f0e9] p-3 text-xs leading-5">{prompt}</pre>
                            {promptIssues.length ? <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-[#8a493b]">{promptIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : null}
                          </details>
                        ) : null}

                        <details className="mt-3 rounded-xl border border-[#e4ddd3] bg-white p-3">
                          <summary className="cursor-pointer text-sm font-semibold">Действия со страницей</summary>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                            <form action={insertPage}>
                              <input type="hidden" name="position" value={page.number} />
                              <button className="min-h-10 w-full rounded-xl border border-[#d8d0c5] px-3 text-sm font-semibold">+ Перед</button>
                            </form>
                            <form action={insertPage}>
                              <input type="hidden" name="position" value={page.number + 1} />
                              <button className="min-h-10 w-full rounded-xl border border-[#d8d0c5] px-3 text-sm font-semibold">+ После</button>
                            </form>
                            <form action={duplicatePage}>
                              <button className="min-h-10 w-full rounded-xl border border-[#d8d0c5] px-3 text-sm font-semibold">Дублировать</button>
                            </form>
                            <form action={movePage} className="flex gap-2">
                              <input name="targetPosition" type="number" min="1" max={book.pages.length} defaultValue={page.number} aria-label="Новая позиция страницы" className="min-h-10 min-w-0 flex-1 rounded-xl border border-[#d8d0c5] px-2" />
                              <button className="rounded-xl border border-[#d8d0c5] px-3 text-sm font-semibold">Переместить</button>
                            </form>
                          </div>
                          {book.pages.length > 1 ? (
                            <form action={deletePage} className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-[#f7e8e2] p-3">
                              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="confirm" value="yes" required /> Подтверждаю удаление страницы {page.number}</label>
                              <button className="rounded-full border border-[#b87666] bg-white px-4 py-2 text-sm font-semibold text-[#8a493b]">Удалить</button>
                            </form>
                          ) : null}
                        </details>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <details className="mt-4 overflow-hidden rounded-2xl border border-[#d8d0c5] bg-[#fffdf8]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 [&::-webkit-details-marker]:hidden">
          <div>
            <h2 className="font-semibold">Дополнительные инструменты</h2>
            <p className="mt-1 text-sm text-[#756d64]">Редко используется · пересборка технической структуры и промптов</p>
          </div>
          <span className="text-sm font-semibold text-[#756d64]">Открыть ↓</span>
        </summary>
        <div className="border-t border-[#e4ddd3] p-4 sm:p-5">
          <p className="max-w-3xl text-sm leading-6 text-[#70685e]">Этот инструмент нужен только если вы вручную изменили структуру истории и хотите заново сформировать технические промпты. Для обычной загрузки иллюстраций, чтения и публикации книги он не требуется.</p>
          <form action={prepareStory} className="mt-4 grid gap-4 sm:grid-cols-2">
            <label>
              <span className="text-sm font-semibold">Story pattern</span>
              <select name="storyPattern" defaultValue={book.authoring?.storyPattern ?? recommendedPattern} className="mt-2 min-h-11 w-full rounded-xl border border-[#d8d0c5] bg-white px-3">
                {Object.entries(storyPatternLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              <span className="text-sm font-semibold">Главный персонаж</span>
              <select name="characterId" defaultValue={book.characters[0] ?? ""} className="mt-2 min-h-11 w-full rounded-xl border border-[#d8d0c5] bg-white px-3">
                <option value="">Без выбранного канонического персонажа</option>
                {characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className="text-sm font-semibold">Style lock (необязательно)</span>
              <input name="visualStyle" defaultValue={book.authoring?.visualStyle ?? ""} maxLength={600} className="mt-2 min-h-11 w-full rounded-xl border border-[#d8d0c5] bg-white px-4" />
            </label>
            <div className="sm:col-span-2"><button type="submit" className="rounded-full bg-[#40382f] px-5 py-2.5 text-sm font-semibold text-white">Пересобрать структуру и промпты</button></div>
          </form>
        </div>
      </details>
    </main>
  );
}
