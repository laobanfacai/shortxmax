import { Logo } from "@/components/public/Logo";
import { PromoBar } from "@/components/public/PromoBar";
import { getActivePromo } from "@/lib/promo";
import { siteConfig } from "@/lib/site";
import Link from "next/link";

export default async function LanderLayout({ children }: { children: React.ReactNode }) {
  const promo = await getActivePromo();
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <PromoBar promo={promo} />
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
        <Logo />
        <Link href="/shows" className="text-sm text-muted hover:text-gold">
          Browse shows
        </Link>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="mx-auto w-full max-w-5xl px-4 py-8 text-center text-xs text-muted">
        <p>
          {siteConfig.name} ·{" "}
          <Link href="/legal/terms" className="hover:text-ink">Terms</Link> ·{" "}
          <Link href="/legal/privacy" className="hover:text-ink">Privacy</Link> ·{" "}
          <Link href="/legal/refund" className="hover:text-ink">Refunds</Link>
        </p>
        <p className="mt-2">Cancel anytime. Access stays until the period you paid for ends.</p>
      </footer>
    </div>
  );
}
