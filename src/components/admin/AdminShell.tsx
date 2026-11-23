import { Logo } from "@/components/public/Logo";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { isAdminTheme, DEFAULT_ADMIN_THEME } from "@/lib/admin-themes";
import { AdminNav } from "./AdminNav";
import { AdminCrumbs } from "./AdminCrumbs";

export function AdminShell({
  children,
  email,
  theme,
  notices,
}: {
  children: React.ReactNode;
  email: string;
  theme: string;
  notices?: { title: string; href: string; time: string }[];
}) {
  const safe = isAdminTheme(theme) ? theme : DEFAULT_ADMIN_THEME;
  const initial = (email || "A").slice(0, 1).toUpperCase();
  return (
    <div className="admin-shell font-admin min-h-screen" data-theme={safe}>
      <div className="grid min-h-screen md:grid-cols-[260px_1fr]">
        <aside className="admin-sidebar border-b md:border-b-0 md:border-r">
          <div className="admin-brand">
            <Logo size="sm" />
            <p className="admin-brand-kicker">短剧运营后台</p>
          </div>
          <AdminNav />
        </aside>
        <div className="flex min-w-0 flex-col" style={{ background: "var(--color-bg)" }}>
          <div className="admin-topbar flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5 md:px-8">
            <AdminCrumbs />
            <div className="flex flex-wrap items-center justify-end gap-3">
              <ThemeSwitcher value={safe} />
              <details className="relative">
                <summary className="admin-notice-btn">
                  通知{notices?.length ? ` ${notices.length}` : ""}
                </summary>
                <div className="admin-card absolute right-0 z-30 mt-2 w-80 p-2 text-sm">
                  {notices?.length ? (
                    notices.map((n) => (
                      <a key={n.href + n.title} href={n.href} className="block rounded-xl px-3 py-2.5 hover:bg-bg">
                        <p>{n.title}</p>
                        <p className="text-xs text-muted">{n.time}</p>
                      </a>
                    ))
                  ) : (
                    <p className="px-3 py-3 text-xs text-muted">暂无新通知</p>
                  )}
                </div>
              </details>
              <div className="admin-user-chip">
                <span className="admin-avatar">{initial}</span>
                <span className="hidden max-w-[10rem] truncate text-xs text-muted sm:inline">{email}</span>
              </div>
            </div>
          </div>
          <div className="admin-main flex-1 px-4 py-6 md:px-8 md:py-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
