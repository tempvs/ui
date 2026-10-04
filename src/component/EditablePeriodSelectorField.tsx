import React, { useMemo } from "react";
import { FaCheck, FaPen } from "react-icons/fa";
import { useIntl } from "react-intl";

import InlineSaveStatus from "./InlineSaveStatus";
import { SaveStatus } from "./EditableFieldRow";
import useInlineEditing from "./useInlineEditing";
import { PERIODS, getPeriodLabel, type Period } from "../util/periods";

type Props = {
  label: React.ReactNode;
  editable: boolean;
  value: readonly Period[];
  onChange: (value: Period[]) => void;
  onBlur: () => void;
  status?: SaveStatus;
  className?: string;
};

const CheckIcon = FaCheck as React.ComponentType;
const PenIcon = FaPen as React.ComponentType;

/** Shared inline multi-period picker: choose values, then save when focus leaves. */
export default function EditablePeriodSelectorField({
  label,
  editable,
  value,
  onChange,
  onBlur,
  status = null,
  className = "mb-2",
}: Props) {
  const intl = useIntl();
  const { editing, beginEditing, endEditing, editRootRef } = useInlineEditing(editable);
  const selected = useMemo(() => new Set(value), [value]);
  const toggle = (period: Period) => {
    const next = new Set(selected);
    if (next.has(period)) next.delete(period);
    else next.add(period);
    onChange(PERIODS.filter((candidate) => next.has(candidate)));
  };
  const finishEditing: React.FocusEventHandler<HTMLDivElement> = (event) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    onBlur();
    endEditing();
  };

  return (
    <div className={`d-flex align-items-center gap-3 ${className}`.trim()}>
      <div className="text-start small fw-semibold" style={{ width: "7rem" }}>
        {label}
      </div>
      <div className="event-period-selector-field">
        {editable ? (
          <div
            ref={editRootRef}
            tabIndex={0}
            className={`inline-editable-control event-period-selector ${editing ? "inline-editable-active" : "inline-editable-readonly"}`}
            onClick={() => {
              if (!editing) beginEditing();
            }}
            onBlur={finishEditing}
          >
            {editing ? (
              <div className="event-period-selector-options">
                {PERIODS.map((period) => {
                  const isSelected = selected.has(period);
                  return (
                    <button
                      key={period}
                      type="button"
                      className={`event-period-selector-option${isSelected ? " is-selected" : ""}`}
                      onClick={() => toggle(period)}
                    >
                      <span>{getPeriodLabel(intl, period)}</span>
                      {isSelected && <CheckIcon aria-label={`${getPeriodLabel(intl, period)} selected`} />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="event-period-selector-summary">
                {value.length
                  ? value.map((period) => <span key={period}>{getPeriodLabel(intl, period)}</span>)
                  : <span className="description-placeholder">No periods</span>}
              </div>
            )}
            {!editing && <span className="inline-editable-glyph" aria-hidden="true"><PenIcon /></span>}
            {status && <span className="inline-editable-status"><InlineSaveStatus status={status} /></span>}
          </div>
        ) : (
          <div className="small text-start px-1 py-1 event-period-selector-summary">
            {value.length
              ? value.map((period) => <span key={period}>{getPeriodLabel(intl, period)}</span>)
              : <span className="description-placeholder">No periods</span>}
          </div>
        )}
      </div>
    </div>
  );
}
