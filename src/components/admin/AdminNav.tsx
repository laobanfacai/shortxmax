"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { GlassCapsuleNav } from "@/components/ui/GlassCapsuleNav";

const groups = [
  {
    title: "运营",
    items: [
      { href: "/admin", label: "数据看板" },
      { href: "/admin/home", label: "首页与轮播" },
      { href: "/admin/shows", label: "剧集管理" },
      { href: "/admin/catalog", label: "目录导入" },
      { href: "/admin/categories", label: "分类管理" },
      { href: "/admin/reviews", label: "评论管理" },
      { href: "/admin/promos", label: "优惠活动" },
    ],
  },
  {
    title: "商务",
    items: [
      { href: "/admin/plans", label: "订阅套餐" },
      { href: "/admin/coins", label: "金币套餐" },
      { href: "/admin/orders", label: "订单列表" },
      { href: "/admin/payments", label: "支付收款" },
    ],
  },
  {
    title: "用户",
    items: [{ href: "/admin/users", label: "用户管理" }, { href: "/admin/members", label: "会员管理" }],
  },
  {
    title: "系统",
    items: [
      { href: "/admin/storage", label: "存储设置" },
      { href: "/admin/settings", label: "站点与广告像素" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

export function AdminNav() {
  const pathname = usePathname();
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim();
    if (!s) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((it) => it.label.includes(s) || it.href.includes(s)),
      }))
      .filter((g) => g.items.length);
  }, [q]);

  const activeKey = filtered.flatMap((g) => g.items).find((it) => isActive(pathname, it.href))?.href ?? null;

  return (
    <nav className="px-3 pb-8 pt-4">
      <label className="mb-3 block px-1">
        <span className="sr-only">搜索菜单</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索菜单…"
          className="input h-9 py-1 text-sm" style={{ borderRadius: "999px" }}
        />
      </label>
      <GlassCapsuleNav
        as="div"
        activeKey={activeKey}
        axis="auto"
        className="admin-nav-track"
        aria-label="后台菜单"
      >
        {filtered.map((g) => (
          <div key={g.title} className="mb-4">
            <p className="admin-nav-group">{g.title}</p>
            <div className="flex gap-1 overflow-x-auto md:overflow-visible md:flex-col">
              {g.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`admin-nav-link glass-capsule-item whitespace-nowrap ${active ? "is-active" : ""}`}
                    data-capsule-active={active ? "true" : "false"}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
        {filtered.length === 0 ? <p className="px-3 text-xs text-muted">没有匹配的菜单</p> : null}
      </GlassCapsuleNav>
      <Link href="/" className="admin-nav-link text-muted">
        返回前台
      </Link>
    </nav>
  );
}
