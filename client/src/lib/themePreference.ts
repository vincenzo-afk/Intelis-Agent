export type AppTheme = "light" | "dark";

type ThemeStorage = Pick<Storage, "getItem" | "setItem">;

export function readThemePreference(storage: ThemeStorage | null, fallback: AppTheme, requestedTheme?: string | null): AppTheme {
  if (requestedTheme === "dark" || requestedTheme === "light") return requestedTheme;
  const stored = storage?.getItem("theme");
  return stored === "dark" || stored === "light" ? stored : fallback;
}

export function persistThemePreference(storage: ThemeStorage | null, theme: AppTheme) {
  storage?.setItem("theme", theme);
}
