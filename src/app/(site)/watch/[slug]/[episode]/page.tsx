import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Player } from "@/components/public/Player";
import { getCurrentUser, getBannedViewer } from "@/lib/auth";
import { canWatchEpisode } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { siteConfig } from "@/lib/site";
import { breadcrumbJsonLd, buildMetadata, JsonLd, tvEpisodeJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; episode: string }>;
}): Promise<Metadata> {
  const { slug, episode } = await params;
  const number = Number(episode);
  const series = await prisma.series.findFirst({ where: { slug, status: "published" } });
  if (!series) return {};
  const ep = await prisma.episode.findFirst({
    where: { seriesId: series.id, number, isPublished: true },
  });
  if (!ep) return {};
  return buildMetadata({
    title: `${series.title} Episode ${ep.number}: ${ep.title}`,
    description:
      ep.synopsis ||
      `Watch ${series.title} Episode ${ep.number} on ${siteConfig.name}. ${series.hook}`,
    path: `/watch/${slug}/${ep.number}`,
    image: series.coverUrl,
    type: "video.other",
  });
}

export default async function WatchPage({
  params,
}: {
  params: Promise<{ slug: string; episode: string }>;
}) {
  const { slug, episode } = await params;
  const number = Number(episode);
  if (!Number.isFinite(number) || number < 1) notFound();

  const series = await prisma.series.findFirst({
    where: { slug, status: "published" },
    include: { episodes: { where: { isPublished: true }, orderBy: { number: "asc" } } },
  });
  if (!series) notFound();
  const ep = series.episodes.find((e) => e.number === number);
  if (!ep) {
    // Catalog-only titles have no Episode rows — never 404 a valid show, never render a broken player.
    redirect(`/shows/${series.slug}`);
  }

  if (await getBannedViewer()) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="font-display text-3xl">This account has been disabled.</h1>
        <p className="mt-3 text-muted">If you think this is a mistake, contact {siteConfig.supportEmail}.</p>
      </div>
    );
  }

  const user = await getCurrentUser();
  const access = await canWatchEpisode({
    userId: user?.id,
    episodeId: ep.id,
    isFree: ep.isFree,
  });
  const history = user
    ? await prisma.watchHistory.findUnique({
        where: { userId_episodeId: { userId: user.id, episodeId: ep.id } },
      })
    : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: series.title, path: `/shows/${series.slug}` },
            { name: `Episode ${ep.number}`, path: `/watch/${series.slug}/${ep.number}` },
          ]),
          tvEpisodeJsonLd({
            seriesTitle: series.title,
            seriesSlug: series.slug,
            episodeTitle: ep.title,
            number: ep.number,
            synopsis: ep.synopsis,
            durationSec: ep.durationSec,
            thumbnail: ep.thumbnailUrl,
            coverUrl: series.coverUrl,
          }),
        ]}
      />
      <p className="mb-4 text-sm text-muted">
        <Link href={`/shows/${series.slug}`} className="hover:text-gold">
          ← {series.title}
        </Link>
      </p>
      <Player
        seriesSlug={series.slug}
        seriesTitle={series.title}
        coverUrl={ep.thumbnailUrl || series.coverUrl}
        episode={{
          id: ep.id,
          number: ep.number,
          title: ep.title,
          isFree: ep.isFree,
          durationSec: ep.durationSec,
          videoUrl: ep.videoUrl && access.allowed ? `/api/playback/${ep.id}` : null,
        }}
        episodes={series.episodes.map((e) => ({
          id: e.id,
          number: e.number,
          title: e.title,
          isFree: e.isFree,
          durationSec: e.durationSec,
          videoUrl: null,
        }))}
        allowed={access.allowed}
        reason={access.reason}
        coinPrice={ep.coinPrice}
        coins={user?.coins ?? 0}
        startAt={history?.progressSec ?? 0}
        signedIn={Boolean(user)}
      />
      {ep.synopsis ? <p className="mx-auto mt-8 max-w-2xl text-sm leading-relaxed text-muted">{ep.synopsis}</p> : null}
    </div>
  );
}
