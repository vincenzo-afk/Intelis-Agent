import { describe, expect, it } from "vitest";
import { persistThemePreference, readThemePreference } from "./themePreference";

function createStorage(initial?: string) {
  let value = initial ?? null;
  return { getItem: () => value, setItem: (_key: string, next: string) => { value = next; } } as Pick<Storage, "getItem" | "setItem">;
}

describe("theme preference", () => {
  it("reads a valid persisted preference and falls back safely", () => {
    expect(readThemePreference(createStorage("dark"), "light")).toBe("dark");
    expect(readThemePreference(createStorage("unexpected"), "light")).toBe("light");
  });

  it("honors an explicit valid requested theme for direct visual preview", () => {
    expect(readThemePreference(createStorage("light"), "light", "dark")).toBe("dark");
  });

  it("persists the chosen theme", () => {
    const storage = createStorage();
    persistThemePreference(storage, "dark");
    expect(readThemePreference(storage, "light")).toBe("dark");
  });
});
