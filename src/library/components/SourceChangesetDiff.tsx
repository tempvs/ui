import type { ReactNode } from "react";

import {
  type HistoricalYear,
  type SourceChangesetSnapshot,
} from "../libraryApi";

type Props = {
  base: SourceChangesetSnapshot;
  proposed: SourceChangesetSnapshot;
  compact?: boolean;
};

function formatYear(value: HistoricalYear | null | undefined) {
  if (!value) return "—";
  return `${value.year}${value.era === "BC" || value.year < 100 ? ` ${value.era}` : ""}`;
}

function formatRange(value: {
  from: HistoricalYear | null;
  to: HistoricalYear | null;
}) {
  return `${formatYear(value.from)} – ${formatYear(value.to)}`;
}

function formatValue(field: string, value: unknown): ReactNode {
  if (field === "years") return formatRange(value as { from: HistoricalYear | null; to: HistoricalYear | null });
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

const fieldLabels: Record<string, string> = {
  name: "Name",
  description: "Description",
  period: "Period",
  classification: "Classification",
  type: "Type",
  years: "Years",
};

/** Shared field-level renderer for the author preview and reviewer detail. */
export default function SourceChangesetDiff({
  base,
  proposed,
  compact = false,
}: Props) {
  const values = {
    name: [base.name, proposed.name],
    description: [base.description, proposed.description],
    period: [base.period, proposed.period],
    classification: [base.classification, proposed.classification],
    type: [base.type, proposed.type],
    years: [
      { from: base.from, to: base.to },
      { from: proposed.from, to: proposed.to },
    ],
  } as const;

  const rows = Object.entries(values).filter(
    ([, [before, after]]) => JSON.stringify(before) !== JSON.stringify(after),
  );

  if (!rows.length) return <p className="text-muted mb-0">No changes.</p>;

  return (
    <div className={compact ? "small" : ""}>
      {rows.map(([field, [before, after]]) => (
        <div className="source-changeset-diff-row" key={field}>
          <div className="fw-semibold small text-uppercase text-muted">
            {fieldLabels[field]}
          </div>
          <div className="source-changeset-diff-values">
            <span className="source-changeset-diff-before" aria-label="Removed or previous value">
              <span aria-hidden="true">− </span>{formatValue(field, before)}
            </span>
            <span className="source-changeset-diff-after" aria-label="Added or proposed value">
              <span aria-hidden="true">+ </span>{formatValue(field, after)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
