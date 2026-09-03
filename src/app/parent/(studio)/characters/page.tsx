import Image from "next/image";
import { connection } from "next/server";
import {
  addCharacterReferenceAction,
  createCharacterAction,
  deleteCharacterAction,
  removeCharacterReferenceAction,
  setCharacterIdentityReferenceAction,
  updateCharacterAction,
  updateCharacterReferenceRoleAction,
} from "@/app/parent/actions";
import { CopyPromptButton } from "@/components/copy-prompt-button";
import { composeCharacterGenerationPrompt } from "@/lib/characters/prompt";
import { loadLibrary } from "@/lib/content/loader";

export default async function ParentCharactersPage() {
  await connection();
  const { characters, books } = await loadLibrary();

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#786f65]">Канонические персонажи</p>
      <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Персонажи</h1>
      <p className="mt-3 max-w-3xl leading-7 text-[#70685e]">Главное здесь — готовый промпт и визуальный референс персонажа. Технические поля сохранены для агента и автоматической сборки промптов, но спрятаны в расширенные настройки.</p>

      <details className="mt-7 rounded-3xl border border-[#cfc5b8] bg-[#f8f4ed] p-6 sm:p-7">
        <summary className="cursor-pointer text-xl font-semibold">+ Создать персонажа</summary>
        <form action={createCharacterAction} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label><span className="text-sm font-semibold">ID</span><input name="id" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="miau" className="mt-2 min-h-12 w-full rounded-xl border border-[#d8d0c5] bg-white px-4" /></label>
          <label><span className="text-sm font-semibold">Имя</span><input name="name" required maxLength={160} className="mt-2 min-h-12 w-full rounded-xl border border-[#d8d0c5] bg-white px-4" /></label>
          <label><span className="text-sm font-semibold">Тип</span><input name="type" required defaultValue="character" maxLength={80} className="mt-2 min-h-12 w-full rounded-xl border border-[#d8d0c5] bg-white px-4" /></label>
          <label><span className="text-sm font-semibold">Вид / species</span><input name="species" maxLength={120} className="mt-2 min-h-12 w-full rounded-xl border border-[#d8d0c5] bg-white px-4" /></label>
          <label className="sm:col-span-2"><span className="text-sm font-semibold">Описание для истории</span><textarea name="narrativeDescription" required rows={3} maxLength={1000} className="mt-2 w-full rounded-xl border border-[#d8d0c5] bg-white p-4" /></label>
          <label className="sm:col-span-2"><span className="text-sm font-semibold">Визуальная идентичность</span><textarea name="identity" required rows={4} maxLength={2000} className="mt-2 w-full rounded-xl border border-[#d8d0c5] bg-white p-4" /></label>
          <label><span className="text-sm font-semibold">Палитра · по одному пункту на строку</span><textarea name="palette" rows={4} className="mt-2 w-full rounded-xl border border-[#d8d0c5] bg-white p-4" /></label>
          <label><span className="text-sm font-semibold">Неизменные признаки · по строке</span><textarea name="fixedTraits" rows={4} className="mt-2 w-full rounded-xl border border-[#d8d0c5] bg-white p-4" /></label>
          <label className="sm:col-span-2"><span className="text-sm font-semibold">Что нельзя менять · по строке</span><textarea name="doNotChange" rows={4} className="mt-2 w-full rounded-xl border border-[#d8d0c5] bg-white p-4" /></label>
          <div className="sm:col-span-2"><button className="rounded-full bg-[#40382f] px-5 py-2.5 text-sm font-semibold text-white">Создать персонажа</button></div>
        </form>
      </details>

      <section className="mt-7 space-y-6">
        {characters.map((character) => {
          const update = updateCharacterAction.bind(null, character.id);
          const addReference = addCharacterReferenceAction.bind(null, character.id);
          const removeCharacter = deleteCharacterAction.bind(null, character.id);
          const usedBy = books.filter((book) => book.characters.includes(character.id) || book.pages.some((page) => page.characters.includes(character.id)));
          const identityReference =
            character.references.find((reference) => reference.role === "identity") ?? null;
          const generationPrompt = composeCharacterGenerationPrompt(character);
          return (
            <article id={`character-${character.id}`} key={character.id} className="scroll-mt-6 rounded-3xl border border-[#d8d0c5] bg-[#fffdf8] p-6 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="text-sm font-semibold text-[#756d64]">{character.id}</p><h2 className="mt-1 text-2xl font-semibold">{character.name}</h2></div>
                <span className="rounded-full bg-[#eee8dd] px-3 py-1 text-xs font-semibold">Используется в книгах: {usedBy.length}</span>
              </div>

              <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(220px,0.72fr)_minmax(0,1.6fr)]">
                <section className="rounded-2xl border border-[#e4ddd3] bg-[#f8f4ed] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-base font-semibold">Главный референс</h3>
                    {identityReference ? <span className="rounded-full bg-[#e5efe7] px-2.5 py-1 text-xs font-semibold">Основной ✓</span> : null}
                  </div>
                  {identityReference ? (
                    <Image
                      unoptimized
                      width={600}
                      height={600}
                      src={`/api/parent/characters/${character.id}/asset?path=${encodeURIComponent(identityReference.path)}`}
                      alt={`Главный референс персонажа ${character.name}`}
                      className="mt-3 aspect-square w-full rounded-xl bg-white object-contain"
                    />
                  ) : (
                    <div className="mt-3 flex aspect-square items-center justify-center rounded-xl border border-dashed border-[#cfc5b8] bg-white p-5 text-center text-sm text-[#756d64]">
                      Главного референса пока нет. Сначала сгенерируйте персонажа по готовому промпту, затем загрузите утверждённую картинку.
                    </div>
                  )}
                  <p className="mt-3 text-xs leading-5 text-[#756d64]">При генерации следующих изображений прикладывайте этот референс вместе с промптом.</p>
                  <form action={addReference} className="mt-4 border-t border-[#e4ddd3] pt-4">
                    <input type="hidden" name="role" value="reference" />
                    <input type="hidden" name="makeIdentity" value="yes" />
                    <label className="block text-sm font-semibold">
                      {identityReference ? "Загрузить новый главный референс" : "Загрузить главный референс"}
                      <input
                        name="image"
                        type="file"
                        required
                        accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
                        className="mt-2 block max-w-full text-xs"
                      />
                    </label>
                    <button className="mt-3 rounded-full border border-[#d8d0c5] bg-white px-4 py-2 text-xs font-semibold">
                      {identityReference ? "Сделать новым основным" : "Загрузить как основной"}
                    </button>
                  </form>
                </section>

                <section className="rounded-2xl border border-[#cfc5b8] bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#786f65]">Для ChatGPT Image</p>
                      <h3 className="mt-1 text-xl font-semibold">Готовый промпт персонажа</h3>
                    </div>
                    <CopyPromptButton text={generationPrompt} />
                  </div>
                  <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap rounded-2xl bg-[#f4f0e9] p-4 text-sm leading-6">{generationPrompt}</pre>
                  <p className="mt-3 text-xs leading-5 text-[#756d64]">Ничего собирать вручную не нужно: палитра, неизменные признаки и запреты уже включены в этот текст.</p>
                </section>
              </div>

              <details className="mt-6 rounded-2xl border border-[#e4ddd3] bg-[#f8f4ed] p-4">
                <summary className="cursor-pointer text-sm font-semibold">Расширенные настройки персонажа</summary>
                <p className="mt-2 text-xs leading-5 text-[#756d64]">Эти поля нужны в основном агенту. Из них автоматически собирается готовый промпт выше.</p>
                <form action={update} className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label><span className="text-sm font-semibold">Имя</span><input name="name" required maxLength={160} defaultValue={character.name} className="mt-2 min-h-12 w-full rounded-xl border border-[#d8d0c5] bg-white px-4" /></label>
                  <label><span className="text-sm font-semibold">Тип</span><input name="type" required maxLength={80} defaultValue={character.type} className="mt-2 min-h-12 w-full rounded-xl border border-[#d8d0c5] bg-white px-4" /></label>
                  <label className="sm:col-span-2"><span className="text-sm font-semibold">Вид / species</span><input name="species" maxLength={120} defaultValue={character.species ?? ""} className="mt-2 min-h-12 w-full rounded-xl border border-[#d8d0c5] bg-white px-4" /></label>
                  <label className="sm:col-span-2"><span className="text-sm font-semibold">Описание для истории</span><textarea name="narrativeDescription" required rows={3} maxLength={1000} defaultValue={character.narrativeDescription} className="mt-2 w-full rounded-xl border border-[#d8d0c5] bg-white p-4" /></label>
                  <label className="sm:col-span-2"><span className="text-sm font-semibold">Визуальная идентичность</span><textarea name="identity" required rows={4} maxLength={2000} defaultValue={character.visual.identity} className="mt-2 w-full rounded-xl border border-[#d8d0c5] bg-white p-4" /></label>
                  <label><span className="text-sm font-semibold">Палитра</span><textarea name="palette" rows={5} defaultValue={character.visual.palette.join("\n")} className="mt-2 w-full rounded-xl border border-[#d8d0c5] bg-white p-4" /></label>
                  <label><span className="text-sm font-semibold">Неизменные признаки</span><textarea name="fixedTraits" rows={5} defaultValue={character.visual.fixedTraits.join("\n")} className="mt-2 w-full rounded-xl border border-[#d8d0c5] bg-white p-4" /></label>
                  <label className="sm:col-span-2"><span className="text-sm font-semibold">Что нельзя менять</span><textarea name="doNotChange" rows={5} defaultValue={character.visual.doNotChange.join("\n")} className="mt-2 w-full rounded-xl border border-[#d8d0c5] bg-white p-4" /></label>
                  <div className="sm:col-span-2"><button className="rounded-full bg-[#40382f] px-5 py-2.5 text-sm font-semibold text-white">Сохранить персонажа</button></div>
                </form>
              </details>

              <details className="mt-4 rounded-2xl border border-[#e4ddd3] bg-[#f8f4ed] p-4">
                <summary className="cursor-pointer text-sm font-semibold">Управлять референсами · {character.references.length}</summary>
                {character.references.length ? (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {character.references.map((reference) => {
                      const setIdentity = setCharacterIdentityReferenceAction.bind(null, character.id, reference.id);
                      const updateRole = updateCharacterReferenceRoleAction.bind(null, character.id, reference.id);
                      const removeReference = removeCharacterReferenceAction.bind(null, character.id, reference.id);
                      return (
                        <figure key={reference.id} className="rounded-2xl bg-[#f4f0e9] p-3">
                          <Image unoptimized width={600} height={600} src={`/api/parent/characters/${character.id}/asset?path=${encodeURIComponent(reference.path)}`} alt={`Референс ${reference.id} персонажа ${character.name}`} className="aspect-square w-full rounded-xl object-contain" />
                          <figcaption className="mt-2 text-xs"><strong>{reference.role === "identity" ? "★ Identity" : reference.role}</strong><br />{reference.id}</figcaption>
                          <form action={updateRole} className="mt-3 flex gap-2">
                            <input name="role" defaultValue={reference.role} required maxLength={80} aria-label={`Роль референса ${reference.id}`} className="min-h-9 min-w-0 flex-1 rounded-lg border border-[#d8d0c5] bg-white px-2 text-xs" />
                            <button className="rounded-lg border border-[#d8d0c5] bg-white px-2 text-xs font-semibold">Роль</button>
                          </form>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {reference.role !== "identity" ? <form action={setIdentity}><button className="rounded-full border border-[#d8d0c5] bg-white px-3 py-1.5 text-xs font-semibold">Сделать identity</button></form> : null}
                            <form action={removeReference}><button className="rounded-full border border-[#b87666] bg-white px-3 py-1.5 text-xs font-semibold text-[#8a493b]">Удалить референс</button></form>
                          </div>
                        </figure>
                      );
                    })}
                  </div>
                ) : <p className="mt-3 text-sm text-[#756d64]">Референсов пока нет.</p>}

                <form action={addReference} className="mt-5 rounded-2xl border border-[#d8d0c5] bg-white p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label><span className="text-sm font-semibold">Изображение</span><input name="image" type="file" required accept="image/png,image/jpeg,image/webp,image/avif,image/gif" className="mt-2 block max-w-full text-sm" /></label>
                    <label><span className="text-sm font-semibold">Роль</span><input name="role" defaultValue="reference" maxLength={80} className="mt-2 min-h-11 w-full rounded-xl border border-[#d8d0c5] px-3" /></label>
                  </div>
                  <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" name="makeIdentity" value="yes" /> Сразу сделать главным identity-reference</label>
                  <button className="mt-3 rounded-full border border-[#d8d0c5] px-4 py-2 text-sm font-semibold">Добавить референс</button>
                </form>
              </details>

              <div className="mt-6 border-t border-[#e4ddd3] pt-5">
                {usedBy.length ? (
                  <p className="text-sm text-[#756d64]">Удаление заблокировано: персонаж используется в {usedBy.map((book) => book.title).join(", ")}.</p>
                ) : (
                  <form action={removeCharacter} className="flex flex-wrap items-center gap-3 rounded-2xl bg-[#f7e8e2] p-3">
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="confirm" value="yes" required /> Подтверждаю удаление персонажа</label>
                    <button className="rounded-full border border-[#b87666] bg-white px-4 py-2 text-sm font-semibold text-[#8a493b]">Удалить персонажа</button>
                  </form>
                )}
              </div>
            </article>
          );
        })}
        {!characters.length ? <p className="rounded-3xl border border-dashed border-[#cfc5b8] p-8 text-center text-[#756d64]">Персонажей пока нет. Создайте первого выше.</p> : null}
      </section>
    </main>
  );
}
