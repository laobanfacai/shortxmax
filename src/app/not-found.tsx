import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <p className="text-xs uppercase tracking-[0.22em] text-gold">404</p>
      <h1 className="mt-3 font-display text-5xl">This episode is missing.</h1>
      <p className="mt-4 text-muted">The page you wanted is not in the catalog. Try the homepage or a genre rail.</p>
      <Link href="/" className="btn btn-gold btn-lg mt-8">
        Back to ShortXMax
      </Link>
    </div>
  );
}
