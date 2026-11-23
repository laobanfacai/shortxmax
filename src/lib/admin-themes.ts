export const ADMIN_THEME_COOKIE = "lumereel_admin_ui";
export const DEFAULT_ADMIN_THEME = "cinema";

export const ADMIN_THEMES = [
  { id: "cinema", label: "墨金影院" },
  { id: "light", label: "暖白日间" },
  { id: "blue", label: "静蓝商务" },
  { id: "violet", label: "绛紫夜色" },
] as const;

export type AdminThemeId = (typeof ADMIN_THEMES)[number]["id"];

export function isAdminTheme(value: string): value is AdminThemeId {
  return ADMIN_THEMES.some((t) => t.id === value);
}
