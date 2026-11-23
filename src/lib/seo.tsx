import type { Metadata } from "next";
import { siteConfig } from "./site";

export function absUrl(pathname = "/") {
  if (pathname.startsWith("http")) return pathname;
  return `${siteConfig.url}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

export function buildMetadata(opts: {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: "website" | "article" | "video.other";
  noIndex?: boolean;
}): Metadata {
  const url = absUrl(opts.path);
  const image = absUrl(opts.image || "/og.jpg");
  const title = opts.title.includes(siteConfig.name)
    ? opts.title
    : `${opts.title} | ${siteConfig.name}`;
  return {
    title: { absolute: title },
    description: opts.description,
    alternates: { canonical: url },
    robots: opts.noIndex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title,
      description: opts.description,
      url,
      siteName: siteConfig.name,
      type: opts.type === "article" ? "article" : "website",
      locale: "en_US",
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: opts.description,
      images: [image],
    },
  };
}

export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function orgJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.url,
    logo: absUrl("/logo.svg"),
    description: siteConfig.tagline,
    email: siteConfig.supportEmail,
    sameAs: [],
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.tagline,
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteConfig.url}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absUrl(item.path),
    })),
  };
}

export function tvSeriesJsonLd(s: {
  title: string;
  slug: string;
  synopsis: string;
  hook: string;
  coverUrl: string;
  genre: string;
  tags: string[];
  rating: number;
  ratingCount: number;
  totalEpisodes: number;
  releaseYear: number;
  trailerUrl?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "TVSeries",
    name: s.title,
    url: absUrl(`/shows/${s.slug}`),
    description: s.synopsis,
    image: absUrl(s.coverUrl),
    genre: [s.genre, ...s.tags],
    inLanguage: "en",
    numberOfEpisodes: s.totalEpisodes,
    datePublished: String(s.releaseYear),
    publisher: { "@type": "Organization", name: siteConfig.name },
    aggregateRating:
      s.ratingCount > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: s.rating,
            bestRating: 5,
            ratingCount: s.ratingCount,
          }
        : undefined,
    trailer: s.trailerUrl
      ? {
          "@type": "VideoObject",
          name: `${s.title} trailer`,
          description: s.hook,
          thumbnailUrl: absUrl(s.coverUrl),
          contentUrl: absUrl(s.trailerUrl),
          uploadDate: `${s.releaseYear}-01-01`,
        }
      : undefined,
  };
}

export function tvEpisodeJsonLd(opts: {
  seriesTitle: string;
  seriesSlug: string;
  episodeTitle: string;
  number: number;
  synopsis?: string | null;
  durationSec: number;
  thumbnail?: string | null;
  coverUrl: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "TVEpisode",
    name: opts.episodeTitle,
    episodeNumber: opts.number,
    url: absUrl(`/watch/${opts.seriesSlug}/${opts.number}`),
    description: opts.synopsis || `${opts.seriesTitle} — Episode ${opts.number}`,
    partOfSeries: {
      "@type": "TVSeries",
      name: opts.seriesTitle,
      url: absUrl(`/shows/${opts.seriesSlug}`),
    },
    image: absUrl(opts.thumbnail || opts.coverUrl),
    timeRequired: `PT${Math.max(1, Math.round(opts.durationSec / 60))}M`,
  };
}
