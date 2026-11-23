import Link from "next/link";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

export function Logo({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const text = size === "lg" ? "text-3xl" : size === "sm" ? "text-xl" : "text-2xl";
  const icon = size === "lg" ? "h-9 w-9" : size === "sm" ? "h-6 w-6" : "h-7 w-7";
  return (
    <Link href="/" className={cn("flex items-center gap-2 group", className)} aria-label={siteConfig.name}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.svg" alt="" width={36} height={36} className={cn("rounded-lg", icon)} />
      <span className={cn("font-display font-semibold tracking-wide gold-text", text)}>
        {siteConfig.name}
      </span>
    </Link>
  );
}
