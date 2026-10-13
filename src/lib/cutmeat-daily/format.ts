const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function formatMoney(value: number | null | undefined) {
  if (value == null) return "—";
  return money.format(value);
}

export function varianceClass(value: number) {
  if (value > 0.004) return "text-emerald-700";
  if (value < -0.004) return "text-red-700";
  return "text-muted-foreground";
}
