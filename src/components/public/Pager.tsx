import Link from "next/link";

export function Pager({
  page,
  pages,
  total,
  hrefFor,
  noun = "titles",
}: {
  page: number;
  pages: number;
  total: number;
  hrefFor: (page: number) => string;
  noun?: string;
}) {
  if (total === 0) return null;
  return (
    <nav className="mt-10 flex flex-wrap items-center justify-between gap-3 text-sm text-muted" aria-label="Pagination">
      <p>
        {total.toLocaleString()} {noun} · Page {page} of {pages}
      </p>
      <div className="flex gap-3">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className="text-gold hover:underline">
            Previous
          </Link>
        ) : (
          <span className="opacity-40">Previous</span>
        )}
        {page < pages ? (
          <Link href={hrefFor(page + 1)} className="text-gold hover:underline">
            Next
          </Link>
        ) : (
          <span className="opacity-40">Next</span>
        )}
      </div>
    </nav>
  );
}
