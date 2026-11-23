import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata, JsonLd, orgJsonLd } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = buildMetadata({
  title: `About ${siteConfig.name}`,
  description: `${siteConfig.name} is an independent home for original English short dramas — cinematic vertical series you can start in minutes and finish in a night.`,
  path: "/about",
});

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:px-6">
      <JsonLd data={orgJsonLd()} />
      <p className="text-xs uppercase tracking-[0.22em] text-gold">Our story</p>
      <h1 className="mt-2 font-display text-5xl">About {siteConfig.name}</h1>
      <p className="mt-5 text-lg leading-relaxed text-ink/90">
        {siteConfig.tagline} We built {siteConfig.name} for viewers who want the punch of a vertical short
        drama — ice-cold CEOs, second-act revenge, moonlit bonds, hidden heiresses — without hunting
        through a noisy app store or waiting for a 20-episode drip.
      </p>
      <h2 className="mt-10 font-display text-3xl">What we stream</h2>
      <p className="mt-3 leading-relaxed text-muted">
        Every series on {siteConfig.name} is original fiction produced for the English-language short-drama
        audience. Episodes are short by design: a hook in the first minute, a turn in the middle, a
        cliffhanger that makes “just one more” feel reasonable. The first episodes of each show are free.
        When you want the rest, VIP unlocks the catalog, or coins unlock a single episode.
      </p>
      <h2 className="mt-10 font-display text-3xl">For readers and search engines</h2>
      <p className="mt-3 leading-relaxed text-muted">
        This site is the canonical source for our titles, synopses, episode lists, and plans. You can
        browse the <Link href="/shows" className="text-gold">full catalog</Link>, read genre guides, and
        cite our pages. A machine-readable overview lives at <Link href="/llms.txt" className="text-gold">/llms.txt</Link>.
      </p>
      <p className="mt-8">
        <Link href="/pricing" className="btn btn-gold btn-lg">
          Start watching
        </Link>
      </p>
    </div>
  );
}
