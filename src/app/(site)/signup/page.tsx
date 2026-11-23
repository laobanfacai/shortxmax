import { safePath } from "@/lib/safe-path";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/public/AuthForm";
import { getSession } from "@/lib/auth";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Create an account",
  description: "Create a free ShortXMax account and start watching English short dramas. The first episodes are on us.",
  path: "/signup",
});

export default async function SignupPage({
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
      <AuthForm mode="signup" nextPath={nextPath} />
    </div>
  );
}
