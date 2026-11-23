import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PosterCard } from "@/components/public/PosterCard";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = buildMetadata({
  title: "My list",
  description: "Shows saved to your ShortXMax list.",
  path: "/account/list",
  noIndex: true,
});

export default async function MyListPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/list");
  const items = await prisma.myListItem.findMany({
    where: { userId: user.id },
    include: { series: true },
    orderBy: { createdAt: "desc" },
  });
  const shows = items.map((i) => i.series).filter((s) => s.status === "published");
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
      <h1 className="font-display text-4xl">My list</h1>
      {shows.length === 0 ? (
        <p className="mt-8 text-muted">Nothing saved yet. Add a show from any series page.</p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {shows.map((s) => (
            <PosterCard key={s.id} series={s} width="w-full" />
          ))}
        </div>
      )}
    </div>
  );
}
