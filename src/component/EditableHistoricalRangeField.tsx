import { useEffect } from "react";
import { FaPen } from "react-icons/fa";

import { type SaveStatus } from "./EditableFieldRow";
import {
  formatHistoricalRange,
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

/** A two-endpoint field that deliberately follows the shared inline field interaction. */
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
  const empty = !from.year && !to.year;

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

  return (
    <div className={`d-flex align-items-center gap-3 ${className}`.trim()}>
      <div className="text-start small fw-semibold" style={{ width: "7rem" }}>{label}</div>
      <div style={{ width: "100%", maxWidth: "16rem" }}>
        {editable ? (
          <div
            ref={editRootRef}
            className={`inline-editable-control ${editing ? "inline-editable-active" : "inline-editable-readonly"}`}
            onClick={() => !editing && beginEditing()}
          >
            {editing ? (
              <div className="d-flex align-items-end gap-2">
                <HistoricalYearControl label={null} value={from} onChange={onFromChange} onBlur={finish} />
                <span className="pb-2 text-muted" aria-hidden="true">–</span>
                <HistoricalYearControl label={null} value={to} onChange={onToChange} onBlur={finish} />
              </div>
            ) : (
              <span className={empty ? "description-placeholder" : undefined}>
                {empty ? "From – To" : formatHistoricalRange(
                  from.year ? { year: Number(from.year), era: from.era } : null,
                  to.year ? { year: Number(to.year), era: to.era } : null,
                )}
              </span>
            )}
            {!editing && <span className="inline-editable-glyph" aria-hidden="true"><PenIcon /></span>}
            {status && <span className="inline-editable-status"><InlineSaveStatus status={status} /></span>}
          </div>
        ) : (
          <div className={`small text-start px-1 py-1 ${empty ? "description-placeholder" : ""}`.trim()}>
            {empty ? "From – To" : formatHistoricalRange(
              from.year ? { year: Number(from.year), era: from.era } : null,
              to.year ? { year: Number(to.year), era: to.era } : null,
            )}
          </div>
        )}
      </div>
    </div>
  );
}
