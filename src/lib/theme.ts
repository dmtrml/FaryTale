export const THEME_STORAGE_KEY = "farytale-theme";

export type ThemePreference = "light" | "dark";

export const themeInitScript = `(() => {
  try {
    const stored = localStorage.getItem("${THEME_STORAGE_KEY}");
    const dark = stored === "dark" || (stored !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  } catch {}
})();`;

