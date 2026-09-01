"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print-hidden rounded-full bg-[#40382f] px-5 py-2.5 text-sm font-semibold text-white"
    >
      Печать / сохранить PDF
    </button>
  );
}
