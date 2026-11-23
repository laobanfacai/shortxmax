"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LABELS: Record<string, string> = {
  admin: "首页",
  home: "首页与轮播",
  shows: "剧集管理",
  catalog: "目录导入",
  categories: "分类管理",
  reviews: "评论管理",
  promos: "优惠活动",
  plans: "订阅套餐",
  coins: "金币套餐",
  orders: "订单列表",
  payments: "支付收款",
  users: "用户管理",
  members: "会员管理",
  storage: "存储设置",
  settings: "站点与广告像素",
  new: "新建",
  episodes: "分集",
};

export function AdminCrumbs() {
  const pathname = usePathname() || "/admin";
  const parts = pathname.split("/").filter(Boolean);
  const crumbs: { href: string; label: string }[] = [];
  let acc = "";
  for (const part of parts) {
    acc += `/${part}`;
    crumbs.push({ href: acc, label: LABELS[part] || (part.length > 16 ? "详情" : part) });
  }
  if (crumbs.length === 1) crumbs[0] = { href: "/admin", label: "数据看板" };
  return (
    <nav className="admin-crumb" aria-label="面包屑">
      {crumbs.map((c, i) => (
        <span key={c.href}>
          {i > 0 ? <span className="mx-1.5 text-muted/70">/</span> : null}
          {i === crumbs.length - 1 ? (
            <span className="text-ink">{c.label}</span>
          ) : (
            <Link href={c.href}>{c.label}</Link>
          )}
        </span>
      ))}
    </nav>
  );
}
