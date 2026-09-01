"use client";

import { useRef, useState, useTransition } from "react";
import { enterParentMode } from "@/app/parent/actions";

const HOLD_MS = 1400;

export function ParentEntryGate() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [holding, setHolding] = useState(false);
  const [pending, startTransition] = useTransition();

  function cancel() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  }

  function begin() {
    if (pending || timer.current) return;
    setHolding(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      startTransition(async () => {
        await enterParentMode();
      });
    }, HOLD_MS);
  }

  return (
    <button
      type="button"
      onPointerDown={begin}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          begin();
        }
      }}
      onKeyUp={(event) => {
        if (event.key === "Enter" || event.key === " ") cancel();
      }}
      disabled={pending}
      className="relative mt-7 min-h-16 w-full max-w-sm overflow-hidden rounded-2xl bg-[#40382f] px-6 py-4 font-semibold text-white shadow-sm disabled:opacity-60"
      aria-label="Нажмите и удерживайте, чтобы войти в режим для родителей"
    >
      <span
        className={`absolute inset-y-0 left-0 bg-white/15 transition-[width] ${holding ? "w-full duration-[1400ms]" : "w-0 duration-150"}`}
        aria-hidden="true"
      />
      <span className="relative">{pending ? "Открываю…" : "Удерживайте 1,4 секунды"}</span>
    </button>
  );
}
