import { redirect } from "next/navigation";

export default async function CheckoutAlias({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan } = await searchParams;
  redirect(plan ? `/pricing?plan=${plan}` : "/pricing");
}
