import { safePath } from "@/lib/safe-path";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/public/AuthForm";
import { getSession } from "@/lib/auth";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Sign in",
  description: "Sign in to ShortXMax to continue watching, manage your VIP plan, and pick up where you left off.",
  path: "/login",
  noIndex: true,
});

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await getSession();
  const { next } = await searchParams;
  const nextPath = safePath(next);
  if (session) redirect(nextPath);
  return (
    <div className="px-4 py-16">
      <AuthForm mode="login" nextPath={nextPath} />
    </div>
  );
}
