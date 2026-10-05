import React from "react";

import EditableFieldRow, { type SaveStatus } from "./EditableFieldRow";
import { HistoricalYearControl, type HistoricalYearInput } from "./HistoricalRangeFilter";

type Props = {
  label: string;
  editable: boolean;
  from: HistoricalYearInput;
  to: HistoricalYearInput;
  onFromChange: (value: HistoricalYearInput) => void;
  onToChange: (value: HistoricalYearInput) => void;
  onBlur: () => void;
  status?: SaveStatus;
  className?: string;
  fieldMaxWidth?: string;
};

/**
 * A paired field implemented through EditableFieldRow. The two endpoint
 * controls remain mounted in both modes, so editing cannot move surrounding
 * markup or change the field's typography and vertical rhythm.
 */
export default function EditableHistoricalRangeField({
  label,
  editable,
  from,
  to,
  onFromChange,
  onToChange,
  onBlur,
  status = null,
  className = "mb-2",
  fieldMaxWidth = "100%",
}: Props) {
  return (
    <EditableFieldRow
      label={label}
      editable={editable}
      status={status}
      className={className}
      fieldMaxWidth={fieldMaxWidth}
      renderControl={({ editing, onBlur: finishEditing }) => (
        <div className="historical-range-inline-control d-flex align-items-center gap-2">
          <HistoricalYearControl
            label={null}
            placeholder="From"
            value={from}
            readOnly={!editing}
            showEra={editing}
            showEraLabel={!editing}
            inputClassName="inline-editable-input"
            onChange={onFromChange}
            onBlur={() => finishEditing(onBlur)}
          />
          <span className="text-muted" aria-hidden="true">–</span>
          <HistoricalYearControl
            label={null}
            placeholder="To"
            value={to}
            readOnly={!editing}
            showEra={editing}
            showEraLabel={!editing}
            inputClassName="inline-editable-input"
            onChange={onToChange}
            onBlur={() => finishEditing(onBlur)}
          />
        </div>
      )}
    />
  );
}
