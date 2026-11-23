"use client";

import { useRouter } from "next/navigation";
import { ADMIN_THEMES, ADMIN_THEME_COOKIE } from "@/lib/admin-themes";

export function ThemeSwitcher({ value }: { value: string }) {
  const router = useRouter();

  function apply(id: string) {
    document.cookie = `${ADMIN_THEME_COOKIE}=${id}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    const root = document.querySelector(".admin-shell");
    if (root) root.setAttribute("data-theme", id);
    router.refresh();
  }

  return (
    <div className="admin-theme-switch" role="radiogroup" aria-label="后台主题">
      {ADMIN_THEMES.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => apply(t.id)}
            className={active ? "is-active" : ""}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
