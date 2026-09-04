"use client";

import { useActionState, useState } from "react";
import { studioChatAction } from "@/app/parent/(studio)/studio/actions";
import { initialStudioChatState } from "@/lib/studio/chat-state";

const quickActions = [
  { label: "Создать новую сказку", value: "Хочу создать новую сказку: " },
  { label: "Показать мои книги", value: "/books" },
  { label: "Показать персонажей", value: "/characters" },
];

export function StudioChat({ initialIntent }: { initialIntent?: string }) {
  const [state, action, pending] = useActionState(studioChatAction, initialStudioChatState);
  const [message, setMessage] = useState(
    initialIntent === "new-story" ? "Хочу создать новую сказку: " : "",
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="rounded-3xl border border-[#d8d0c5] bg-[#fffdf8] p-4 sm:p-6">
        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1" aria-live="polite">
          {state.messages.map((item, index) => (
            <div
              key={`${index}-${item.role}`}
              className={item.role === "user" ? "ml-auto max-w-[85%] rounded-2xl bg-[#40382f] px-4 py-3 text-white" : "mr-auto max-w-[92%] rounded-2xl bg-[#f1ece3] px-4 py-3"}
            >
              <div className="whitespace-pre-wrap text-sm leading-6">{item.text}</div>
            </div>
          ))}
        </div>

        <form action={action} className="mt-5 border-t border-[#e2dbd1] pt-5">
          <label className="text-sm font-semibold" htmlFor="studio-message">Опишите, что хотите сделать</label>
          <textarea
            id="studio-message"
            name="message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={3}
            maxLength={120000}
            required
            className="mt-2 w-full rounded-2xl border border-[#d8d0c5] bg-white p-4 leading-6 outline-none focus:border-[#625a51]"
            placeholder="Например: хочу сделать короткую сказку про уборку игрушек"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button disabled={pending} className="rounded-full bg-[#40382f] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50" type="submit">
              {pending ? "Выполняю…" : "Отправить"}
            </button>
            {quickActions.map((item) => (
              <button key={item.label} type="button" onClick={() => setMessage(item.value)} className="rounded-full border border-[#d8d0c5] bg-white px-3 py-2 text-xs font-semibold">
                {item.label}
              </button>
            ))}
          </div>
        </form>
      </section>

      <aside className="rounded-3xl border border-[#d8d0c5] bg-[#f8f4ed] p-5 text-sm leading-6">
        <h2 className="font-semibold">Как удобнее работать</h2>
        <p className="mt-2 text-[#70685e]">Сначала опишите идею и утвердите текст истории. После этого книга сохраняется целиком: со страницами, персонажами и промптами.</p>
        <p className="mt-4 text-[#70685e]">Иллюстрации по умолчанию создаются отдельно: приложение подготовит промпты, а готовые картинки вы загрузите в нужные страницы.</p>
        <details className="mt-5 border-t border-[#d8d0c5] pt-4">
          <summary className="cursor-pointer text-xs font-semibold text-[#756d64]">Технические команды</summary>
          <p className="mt-2 text-xs text-[#756d64]">Для диагностики по-прежнему доступны /help, /books и другие project-команды.</p>
        </details>
      </aside>
    </div>
  );
}
