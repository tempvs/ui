import type { HistoricalYearInput } from "../component/HistoricalRangeFilter";

export type HistoricalYear = { year: number; era: "BC" | "AD" };
export type PublicHistoricalRange = {
  from: HistoricalYear | null;
  to: HistoricalYear | null;
};

/**
 * The public-discovery contract shared by header search, catalogue pages and
 * map URLs. UI controls retain BC/AD explicitly; map API requests use the
 * corresponding astronomical year only at their HTTP boundary.
 */
export function rangeFromInputs(
  from: HistoricalYearInput,
  to: HistoricalYearInput,
): PublicHistoricalRange {
  return {
    from: from.year ? { year: Number(from.year), era: from.era } : null,
    to: to.year ? { year: Number(to.year), era: to.era } : null,
  };
}

export function historicalOrdinal(
  value?: HistoricalYear | null,
): number | null {
  if (!value) return null;
  return value.era === "BC" ? 1 - value.year : value.year;
}

/** Unknown/open-ended entity dates remain discoverable, by product policy. */
export function overlapsHistoricalRange(
  item: { from?: HistoricalYear | null; to?: HistoricalYear | null },
  range: PublicHistoricalRange,
): boolean {
  if (!item.from && !item.to) return true;
  const itemFrom = historicalOrdinal(item.from);
  const itemTo = historicalOrdinal(item.to);
  const filterFrom = historicalOrdinal(range.from);
  const filterTo = historicalOrdinal(range.to);
  return (
    (itemTo === null || filterFrom === null || itemTo >= filterFrom) &&
    (filterTo === null || itemFrom === null || itemFrom <= filterTo)
  );
}

export function toAstronomicalYear(
  value: HistoricalYear | null,
): number | undefined {
  if (!value) return undefined;
  return value.era === "BC" ? 1 - value.year : value.year;
}

/** URL keys are intentionally stable and human-readable across public pages. */
export function publicSearchParams({
  query,
  period,
  range,
}: {
  query?: string;
  period?: string;
  range?: PublicHistoricalRange;
}): URLSearchParams {
  const params = new URLSearchParams();
  if (query?.trim()) params.set("q", query.trim());
  if (period) params.set("period", period);
  if (range?.from) {
    params.set("fromYear", String(range.from.year));
    params.set("fromEra", range.from.era);
  }
  if (range?.to) {
    params.set("toYear", String(range.to.year));
    params.set("toEra", range.to.era);
  }
  return params;
}

/** Map keeps source/event/profile namespaces so filters cannot accidentally affect
 * another selected layer. This projects the common UI contract into it. */
export function appendMapSearchParams(
  params: URLSearchParams,
  range: PublicHistoricalRange,
  namespace: "source" | "event" | "profile",
): URLSearchParams {
  const from = toAstronomicalYear(range.from);
  const to = toAstronomicalYear(range.to);
  if (from !== undefined) params.set(`${namespace}From`, String(from));
  if (to !== undefined) params.set(`${namespace}To`, String(to));
  return params;
}
