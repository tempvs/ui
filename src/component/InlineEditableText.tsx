import React, { useEffect, useRef, useState } from 'react';
import { Form } from 'react-bootstrap';
import { FaPen } from 'react-icons/fa';

import InlineSaveStatus from './InlineSaveStatus';
import { SaveStatus } from './EditableFieldRow';

type InlineEditableTextProps = {
  editable: boolean;
  value?: string | number | string[];
  readOnlyValue?: React.ReactNode;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  status?: SaveStatus;
  placeholder?: string;
  className?: string;
  textClassName?: string;
  placeholderDisplay?: boolean;
  savingTitle?: string;
  errorTitle?: string;
};

const PenIcon = FaPen as React.ComponentType;

export default function InlineEditableText({
  editable,
  value,
  readOnlyValue,
  onChange,
  onBlur,
  status = null,
  placeholder,
  className = '',
  textClassName = '',
  placeholderDisplay = false,
  savingTitle = 'Saving',
  errorTitle = 'Save failed',
}: InlineEditableTextProps) {
  const [editing, setEditing] = useState(false);
  const [blurredAfterEdit, setBlurredAfterEdit] = useState(false);
  const controlRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) {
      controlRef.current?.focus();
    }
  }, [editing]);

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

  const handleBlur: React.FocusEventHandler<HTMLInputElement> = event => {
    onBlur?.(event);
    setBlurredAfterEdit(true);
  };

  if (!editable) {
    return (
      <div className={`${textClassName} ${placeholderDisplay ? 'description-placeholder' : ''} text-start`.trim()}>
        {readOnlyValue}
      </div>
    );
  }

  const readOnlyDisplayValue = typeof readOnlyValue === 'string' || typeof readOnlyValue === 'number'
    ? String(readOnlyValue)
    : '';
  const controlValue = editing ? value : (value || readOnlyDisplayValue);

  return (
    <div className={`inline-editable-text ${className}`.trim()}>
      <div
        className={`inline-editable-control ${editing ? 'inline-editable-active' : 'inline-editable-readonly'}`}
        onClick={() => {
          if (!editing) {
            setBlurredAfterEdit(false);
            setEditing(true);
          }
        }}
      >
        <Form.Control
          ref={controlRef}
          type="text"
          readOnly={!editing}
          className={`inline-editable-input ${textClassName} ${!editing && placeholderDisplay ? 'description-placeholder' : ''}`.trim()}
          value={controlValue ?? ''}
          onChange={onChange}
          onBlur={handleBlur}
          placeholder={placeholder}
        />
        {!editing && (
          <span className="inline-editable-glyph" aria-hidden="true">
            <PenIcon />
          </span>
        )}
        {status && (
          <span className="inline-editable-status">
            <InlineSaveStatus status={status} savingTitle={savingTitle} errorTitle={errorTitle} />
          </span>
        )}
      </div>
    </div>
  );
}
