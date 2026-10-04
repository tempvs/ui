import { useEffect } from "react";
import { FaPen } from "react-icons/fa";

import { type SaveStatus } from "./EditableFieldRow";
import {
  HistoricalYearControl,
  isValidHistoricalYear,
  type HistoricalYearInput,
} from "./HistoricalRangeFilter";
import InlineSaveStatus from "./InlineSaveStatus";
import useInlineEditing from "./useInlineEditing";

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
};

const PenIcon = FaPen as React.ComponentType;

/**
 * A paired year range that uses the standard click-to-edit interaction while
 * preserving the positions of the endpoint labels and values.
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
}: Props) {
  const { editing, beginEditing, endEditing, editRootRef } = useInlineEditing<HTMLDivElement>(editable);
  const valid = isValidHistoricalYear(from) && isValidHistoricalYear(to);

  useEffect(() => {
    if (!editing) return;
    editRootRef.current?.querySelector<HTMLInputElement>('input[type="text"]')?.focus();
  }, [editing, editRootRef]);

  const finish = () => {
    window.setTimeout(() => {
      if (editRootRef.current?.contains(document.activeElement)) return;
      if (valid) onBlur();
      endEditing();
    }, 0);
  };

  const endpoints = (
    <div className="d-flex align-items-center gap-2 flex-wrap">
      <YearEndpoint label="From" value={from} editing={editing} onChange={onFromChange} onBlur={finish} />
      <span className="text-muted" aria-hidden="true">–</span>
      <YearEndpoint label="To" value={to} editing={editing} onChange={onToChange} onBlur={finish} />
    </div>
  );

  return (
    <div className={`d-flex align-items-center gap-3 ${className}`.trim()}>
      <div className="text-start small fw-semibold" style={{ width: "7rem" }}>{label}</div>
      <div style={{ width: "100%", maxWidth: "28rem" }}>
        {editable ? (
          <div
            ref={editRootRef}
            className={`inline-editable-control ${editing ? "inline-editable-active" : "inline-editable-readonly"}`}
            onClick={() => !editing && beginEditing()}
          >
            {endpoints}
            {!editing && <span className="inline-editable-glyph" aria-hidden="true"><PenIcon /></span>}
            {status && <span className="inline-editable-status"><InlineSaveStatus status={status} /></span>}
          </div>
        ) : (
          <div className="small text-start px-1 py-1">{endpoints}</div>
        )}
      </div>
    </div>
  );
}

function YearEndpoint({
  label,
  value,
  editing,
  onChange,
  onBlur,
}: {
  label: "From" | "To";
  value: HistoricalYearInput;
  editing: boolean;
  onChange: (value: HistoricalYearInput) => void;
  onBlur: () => void;
}) {
  const displayValue = value.year ? `${value.year}${value.era === "BC" ? " BC" : ""}` : label;
  return (
    <div className="d-flex align-items-center" style={{ minWidth: "8.25rem" }}>
      {editing ? (
        <HistoricalYearControl label={null} placeholder={label} value={value} onChange={onChange} onBlur={onBlur} />
      ) : (
        <span className={value.year ? undefined : "description-placeholder"} style={{ minWidth: "5.25rem" }}>
          {displayValue}
        </span>
      )}
    </div>
  );
}
