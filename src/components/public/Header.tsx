import Link from "next/link";
import { Logo } from "./Logo";
import { PrimaryNav } from "./PrimaryNav";
import { siteConfig } from "@/lib/site";
import type { SessionUser } from "@/lib/session-token";

export function Header({ user, genres }: { user: SessionUser | null; genres: { slug: string; name: string }[] }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 md:px-6">
        <Logo />
        <PrimaryNav genres={genres} />
        <form action="/search" className="ml-auto hidden max-w-xs flex-1 md:block" role="search">
          <label className="sr-only" htmlFor="q">
            Search short dramas
          </label>
          <input
            id="q"
            name="q"
            placeholder={`Search ${siteConfig.name}...`}
            className="input h-10 py-1 text-sm"
          />
        </form>
        <div className="ml-auto flex items-center gap-2 md:ml-3">
          <Link href="/search" className="btn btn-ghost btn-sm md:hidden" aria-label="Search">
            Search
          </Link>
          {user ? (
            <Link href="/account" className="btn btn-ghost btn-sm">
              {user.name?.split(" ")[0] || "Account"}
            </Link>
          ) : (
            <div className="flex gap-2"><Link href="/login" className="btn btn-ghost btn-sm">Sign in</Link><Link href="/signup" className="btn btn-outline-gold btn-sm">Join free</Link></div>
          )}
          <Link href="/pricing" className="btn btn-gold btn-sm">
            Go VIP
          </Link>
        </div>
      </div>
    </header>
  );
}
