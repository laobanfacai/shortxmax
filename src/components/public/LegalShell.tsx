import { siteConfig } from "@/lib/site";

export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <article className="prose-legal mx-auto max-w-3xl px-4 py-12 md:px-6">
      <p className="text-xs uppercase tracking-[0.22em] text-gold">Legal</p>
      <h1 className="mt-2 font-display text-4xl text-ink">{title}</h1>
      <p className="text-sm text-muted">Last updated: {updated}</p>
      <p className="mt-4 text-sm text-muted">
        These terms apply to {siteConfig.name} at {siteConfig.url}. Questions: {siteConfig.supportEmail}.
      </p>
      {children}
    </article>
  );
}
