export type HistoricalYearValue = { year: number; era: "BC" | "AD" };

export function isHistoricalYearValue(value: unknown): value is HistoricalYearValue {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.year === "number"
    && Number.isInteger(candidate.year)
    && candidate.year > 0
    && (candidate.era === "BC" || candidate.era === "AD");
}

/** AD is implicit from 100 onward; early AD and every BC date stay explicit. */
export function formatHistoricalYear(value: HistoricalYearValue | null | undefined): string {
  if (!value) return "…";
  return `${value.year}${value.era === "BC" || value.year < 100 ? ` ${value.era}` : ""}`;
}
