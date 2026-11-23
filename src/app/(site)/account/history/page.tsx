import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = buildMetadata({
  title: "Watch history",
  description: "Resume the short dramas you started on ShortXMax.",
  path: "/account/history",
  noIndex: true,
});

export default async function HistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/history");
  const rows = await prisma.watchHistory.findMany({
    where: { userId: user.id },
    include: { episode: { include: { series: true } } },
    orderBy: { updatedAt: "desc" },
    take: 40,
  });
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:px-6">
      <h1 className="font-display text-4xl">Watch history</h1>
      {rows.length === 0 ? (
        <p className="mt-8 text-muted">You have not started a show yet.</p>
      ) : (
        <ul className="mt-8 divide-y divide-white/5 rounded-2xl border border-white/10">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/watch/${r.episode.series.slug}/${r.episode.number}`}
                className="flex items-center gap-4 px-4 py-3 hover:bg-white/5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.episode.series.coverUrl}
                  alt=""
                  className="h-16 w-12 rounded object-cover"
                />
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.episode.series.title}</p>
                  <p className="text-sm text-muted">
                    Ep {r.episode.number}: {r.episode.title}
                    {r.completed ? " · Finished" : ""}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
