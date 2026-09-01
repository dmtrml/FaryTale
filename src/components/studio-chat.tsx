"use client";

import { useActionState, useState } from "react";
import { studioChatAction } from "@/app/parent/(studio)/studio/actions";
import { initialStudioChatState } from "@/lib/studio/chat-state";

const quickCommands = ["/help", "/books", "/characters"];

export function StudioChat() {
  const [state, action, pending] = useActionState(studioChatAction, initialStudioChatState);
  const [message, setMessage] = useState("");

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="rounded-3xl border border-[#d8d0c5] bg-[#fffdf8] p-4 sm:p-6">
        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1" aria-live="polite">
          {state.messages.map((item, index) => (
            <div
              key={`${index}-${item.role}`}
              className={item.role === "user" ? "ml-auto max-w-[85%] rounded-2xl bg-[#40382f] px-4 py-3 text-white" : "mr-auto max-w-[92%] rounded-2xl bg-[#f1ece3] px-4 py-3"}
            >
              {item.tool ? <div className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] opacity-60">{item.tool}</div> : null}
              <div className="whitespace-pre-wrap text-sm leading-6">{item.text}</div>
            </div>
          ))}
        </div>

        <form action={action} className="mt-5 border-t border-[#e2dbd1] pt-5">
          <label className="text-sm font-semibold" htmlFor="studio-message">Сообщение Studio</label>
          <textarea
            id="studio-message"
            name="message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={3}
            maxLength={120000}
            required
            className="mt-2 w-full rounded-2xl border border-[#d8d0c5] bg-white p-4 leading-6 outline-none focus:border-[#625a51]"
            placeholder="Например: /book miau-washes-paws или high-level approved story package"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button disabled={pending} className="rounded-full bg-[#40382f] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50" type="submit">
              {pending ? "Выполняю…" : "Отправить"}
            </button>
            {quickCommands.map((command) => (
              <button key={command} type="button" onClick={() => setMessage(command)} className="rounded-full border border-[#d8d0c5] bg-white px-3 py-2 text-xs font-semibold">
                {command}
              </button>
            ))}
          </div>
        </form>
      </section>

      <aside className="rounded-3xl border border-[#d8d0c5] bg-[#f8f4ed] p-5 text-sm leading-6">
        <h2 className="font-semibold">Что уже умеет</h2>
        <p className="mt-2 text-[#70685e]">Основной путь — agent-first materialize approved story: вся утверждённая книга сохраняется одним workflow, включая страницы, персонажей и prompt для каждой сцены.</p>
        <p className="mt-4 text-[#70685e]">Изображения этим workflow не генерируются: страницы остаются prompt_ready для ручной генерации и загрузки.</p>
      </aside>
    </div>
  );
}
