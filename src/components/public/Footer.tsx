import Link from "next/link";
import { Logo } from "./Logo";
import { siteConfig } from "@/lib/site";

export function Footer({ genres }: { genres: { slug: string; name: string }[] }) {
  return (
    <footer className="mt-16 border-t border-white/5 bg-bg-soft">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-4 md:px-6">
        <div className="md:col-span-1">
          <Logo />
          <p className="mt-3 text-sm leading-relaxed text-muted">{siteConfig.tagline}</p>
          <p className="mt-4 text-xs text-muted">
            Original English short dramas. Stream on the web — no app store required.
          </p>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Browse</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li><Link href="/shows" className="hover:text-ink">All shows</Link></li>
            <li><Link href="/genres" className="hover:text-ink">Genre hub</Link></li>
            {genres.map((g) => (
              <li key={g.slug}>
                <Link href={`/genres/${g.slug}`} className="hover:text-ink">{g.name}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Company</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li><Link href="/about" className="hover:text-ink">About</Link></li>
            <li><Link href="/faq" className="hover:text-ink">FAQ</Link></li>
            <li><Link href="/pricing" className="hover:text-ink">VIP plans</Link></li>
            <li><Link href="/editorial/best-billionaire-short-dramas" className="hover:text-ink">Guides</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Legal</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li><Link href="/legal/terms" className="hover:text-ink">Terms of Use</Link></li>
            <li><Link href="/legal/privacy" className="hover:text-ink">Privacy Policy</Link></li>
            <li><Link href="/legal/refund" className="hover:text-ink">Refund Policy</Link></li>
            <li>
              <a href={`mailto:${siteConfig.supportEmail}`} className="hover:text-ink">
                {siteConfig.supportEmail}
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/5 py-5 text-center text-xs text-muted">
        © {new Date().getFullYear()} {siteConfig.name}. All rights reserved. Stories are original fiction.
      </div>
    </footer>
  );
}
