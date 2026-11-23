import { Footer } from "@/components/public/Footer";
import { Header } from "@/components/public/Header";
import { MobileNav } from "@/components/public/MobileNav";
import { PathAwareSticky } from "@/components/public/PathAwareSticky";
import { PromoBar } from "@/components/public/PromoBar";
import { getSession, getCurrentUser } from "@/lib/auth";
import { getActiveSubscription } from "@/lib/access";
import { getActivePromo } from "@/lib/promo";
import { getEnabledGenres } from "@/lib/genres";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [session, user, promo, genres] = await Promise.all([
    getSession(),
    getCurrentUser(),
    getActivePromo(),
    getEnabledGenres(),
  ]);
  const vip = user ? await getActiveSubscription(user.id) : null;
  return (
    <div className="flex min-h-screen flex-col pb-16 md:pb-0">
      <PromoBar promo={promo} />
      <Header user={session} genres={genres} />
      <main className="flex-1">{children}</main>
      <Footer genres={genres} />
      <MobileNav user={session} />
      <PathAwareSticky hidden={Boolean(vip)} promo={promo} />
    </div>
  );
}
