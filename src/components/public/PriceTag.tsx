import { formatMoney } from "@/lib/utils";

export function PriceTag({
  listCents,
  saleCents,
  currency = "USD",
  suffix,
  size = "lg",
}: {
  listCents: number;
  saleCents: number;
  currency?: string;
  suffix?: string;
  size?: "lg" | "md";
}) {
  const onSale = saleCents < listCents;
  const num = size === "lg" ? "font-display text-5xl text-gold-soft" : "font-display text-3xl text-gold-soft";
  return (
    <p className={num}>
      {onSale ? (
        <>
          <span className="mr-2 text-2xl text-muted line-through decoration-danger/70">{formatMoney(listCents, currency)}</span>
          {formatMoney(saleCents, currency)}
        </>
      ) : (
        formatMoney(saleCents, currency)
      )}
      {suffix ? <span className="text-base text-muted"> {suffix}</span> : null}
    </p>
  );
}
