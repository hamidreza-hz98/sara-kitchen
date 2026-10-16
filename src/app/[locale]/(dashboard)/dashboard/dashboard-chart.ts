export type SalesBucket = Readonly<{
  date: string;
  grossCents: number;
  refundsCents: number;
  netCents: number;
}>;

/** Group adjacent days for legible small charts without changing total cents. */
export function compactSalesChart(buckets: readonly SalesBucket[], maxBars = 12) {
  if (!Number.isInteger(maxBars) || maxBars < 1) throw new RangeError("Invalid chart width.");
  const width = Math.max(1, Math.ceil(buckets.length / maxBars));
  const result: Array<SalesBucket & { endDate: string }> = [];
  for (let index = 0; index < buckets.length; index += width) {
    const group = buckets.slice(index, index + width);
    result.push({
      date: group[0]!.date,
      endDate: group.at(-1)!.date,
      grossCents: group.reduce((sum, item) => sum + item.grossCents, 0),
      refundsCents: group.reduce((sum, item) => sum + item.refundsCents, 0),
      netCents: group.reduce((sum, item) => sum + item.netCents, 0),
    });
  }
  return result;
}
