import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { THEME_STORAGE_KEY, themeInitScript } from "./theme";

function executeThemeScript(stored: string | null, systemDark: boolean) {
  let darkClass = false;
  const dataset: Record<string, string> = {};
  vm.runInNewContext(themeInitScript, {
    localStorage: {
      getItem(key: string) {
        return key === THEME_STORAGE_KEY ? stored : null;
      },
    },
    window: {
      matchMedia() {
        return { matches: systemDark };
      },
    },
    document: {
      documentElement: {
        classList: {
          toggle(_name: string, enabled: boolean) {
            darkClass = enabled;
          },
        },
        dataset,
      },
    },
  });
  return { darkClass, theme: dataset.theme };
}

describe("theme initialization", () => {
  it("uses the saved preference before the system preference", () => {
    expect(executeThemeScript("dark", false)).toEqual({ darkClass: true, theme: "dark" });
    expect(executeThemeScript("light", true)).toEqual({ darkClass: false, theme: "light" });
  });

  it("falls back to the operating-system preference", () => {
    expect(executeThemeScript(null, true)).toEqual({ darkClass: true, theme: "dark" });
    expect(executeThemeScript(null, false)).toEqual({ darkClass: false, theme: "light" });
  });
});
