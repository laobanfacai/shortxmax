import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatShanghaiDisplay } from "@/lib/time";
import { ADMIN_THEME_COOKIE, DEFAULT_ADMIN_THEME } from "@/lib/admin-themes";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  if (!admin) redirect("/login?next=/admin");
  const theme = (await cookies()).get(ADMIN_THEME_COOKIE)?.value || DEFAULT_ADMIN_THEME;
  const recent = await prisma.order.findMany({
    where: { status: "paid" },
    orderBy: { paidAt: "desc" },
    take: 5,
    include: { user: { select: { email: true } } },
  });
  const notices = recent.map((o) => ({
    title: `${o.user.email} · ${o.type} · $${(o.amountCents / 100).toFixed(2)}`,
    href: "/admin/orders",
    time: formatShanghaiDisplay(o.paidAt || o.createdAt),
  }));
  return (
    <AdminShell email={admin.email} theme={theme} notices={notices}>
      {children}
    </AdminShell>
  );
}
