"use client";

import { THEME_STORAGE_KEY } from "@/lib/theme";

export function ThemeToggle() {
  function toggleTheme() {
    const root = document.documentElement;
    const dark = !root.classList.contains("dark");
    root.classList.toggle("dark", dark);
    root.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem(THEME_STORAGE_KEY, dark ? "dark" : "light");
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="theme-toggle rounded-full border border-[#d8d0c5] px-4 py-2 text-sm font-semibold"
      aria-label="Переключить светлую и тёмную тему"
      title="Переключить тему"
    >
      <span className="theme-label-light">🌙 Тёмная</span>
      <span className="theme-label-dark">☀️ Светлая</span>
    </button>
  );
}

