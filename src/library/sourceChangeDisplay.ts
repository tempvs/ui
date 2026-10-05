import { formatHistoricalYear, isHistoricalYearValue } from "../util/historicalYear";

export function sourceChangeFieldLabel(field: string): string {
  return ({ name: "Name", description: "Description", from: "From", to: "To" } as Record<string, string>)[field]
    || field;
}

export function formatSourceChangeValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "(empty)";
  if (isHistoricalYearValue(value)) return formatHistoricalYear(value);
  return typeof value === "string" || typeof value === "number" ? String(value) : "(unavailable)";
}
