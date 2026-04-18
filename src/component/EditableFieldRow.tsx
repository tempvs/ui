import React, { useEffect, useState } from 'react';
import { FaPen } from 'react-icons/fa';

import InlineSaveStatus from './InlineSaveStatus';

export type SaveStatus = 'pending' | 'saving' | 'saved' | 'error' | string | null | undefined;

type EditableFieldRowProps = {
  label?: React.ReactNode;
  editable: boolean;
  control: React.ReactNode;
  readOnlyValue?: React.ReactNode;
  readOnlyInputValue?: string | number | string[];
  placeholderDisplay?: boolean;
  status?: SaveStatus;
  action?: React.ReactNode;
  actionPlacement?: 'inline' | 'stacked';
  labelWidth?: string;
  fieldMaxWidth?: string;
  savingTitle?: string;
  errorTitle?: string;
  className?: string;
};

const PenIcon = FaPen as React.ComponentType;

export default function EditableFieldRow({
  label,
  editable,
  control,
  readOnlyValue,
  readOnlyInputValue,
  placeholderDisplay = false,
  status = null,
  action = null,
  actionPlacement = 'inline',
  labelWidth = '7rem',
  fieldMaxWidth = '16rem',
  savingTitle = 'Saving',
  errorTitle = 'Save failed',
  className = 'mb-2',
}: EditableFieldRowProps) {
  const [editing, setEditing] = useState(false);
  const [blurredAfterEdit, setBlurredAfterEdit] = useState(false);

  useEffect(() => {
    if (!editing || !blurredAfterEdit) {
      return undefined;
    }

    if (!status) {
      setEditing(false);
      return undefined;
    }

    if (status === 'saved' || status === 'error') {
      const timerId = window.setTimeout(() => {
        setEditing(false);
      }, 900);
      return () => window.clearTimeout(timerId);
    }

    return undefined;
  }, [blurredAfterEdit, editing, status]);

  const controlProps = React.isValidElement(control)
    ? control.props as {
      className?: string;
      onBlur?: (event: React.FocusEvent<HTMLElement>) => void;
      value?: string | number | string[];
    }
    : {};
  const editableControl = React.isValidElement(control)
    ? React.cloneElement(control as React.ReactElement<Record<string, unknown>>, {
      autoFocus: editing,
      readOnly: !editing,
      disabled: !editing && control.type && String(control.type).includes('Select'),
      value: editing ? controlProps.value : (readOnlyInputValue ?? controlProps.value),
      className: `${controlProps.className || ''} inline-editable-input ${editing ? 'inline-editable-active-input' : 'inline-editable-readonly-input'} ${!editing && placeholderDisplay ? 'description-placeholder' : ''}`.trim(),
      onBlur: (event: React.FocusEvent<HTMLElement>) => {
        controlProps.onBlur?.(event);
        setBlurredAfterEdit(true);
      },
    })
    : control;

  return (
    <div className={`d-flex align-items-center gap-3 ${className}`.trim()}>
      <div className="text-start small fw-semibold" style={{ width: labelWidth }}>
        {label}
      </div>
      <div style={{ width: '100%', maxWidth: fieldMaxWidth }}>
        {editable ? (
          <div
            className={`inline-editable-control ${editing ? 'inline-editable-active' : 'inline-editable-readonly'}`}
            onClick={() => {
              if (!editing) {
                setBlurredAfterEdit(false);
                setEditing(true);
              }
            }}
          >
            {editableControl}
            {!editing && (
              <span className="inline-editable-glyph" aria-hidden="true">
                <PenIcon />
              </span>
            )}
            {(status || action) && (
              actionPlacement === 'stacked' ? (
                <div className="d-flex align-items-center gap-2 mt-2">
                  {status && <InlineSaveStatus status={status} savingTitle={savingTitle} errorTitle={errorTitle} />}
                  {!status && action}
                </div>
              ) : (
                <span className="inline-editable-status">
                  {status && <InlineSaveStatus status={status} savingTitle={savingTitle} errorTitle={errorTitle} />}
                  {!status && action}
                </span>
              )
            )}
          </div>
        ) : (
          <div className={`small text-start px-1 py-1 ${placeholderDisplay ? 'description-placeholder' : ''}`.trim()}>
            {readOnlyValue}
          </div>
        )}
      </div>
    </div>
  );
}
