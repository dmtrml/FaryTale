"use client";

import { useState } from "react";

export function CopyPromptButton({
  text,
  label = "Скопировать промпт",
}: {
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded-full border border-[#d8d0c5] bg-white px-4 py-2 text-sm font-semibold"
    >
      {copied ? "Скопировано" : label}
    </button>
  );
}
