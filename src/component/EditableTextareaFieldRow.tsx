import React from 'react';
import { Form } from 'react-bootstrap';

import EditableFieldRow, { SaveStatus } from './EditableFieldRow';

type EditableTextareaFieldRowProps = {
  label?: React.ReactNode;
  editable: boolean;
  value?: string | number | string[];
  readOnlyValue?: React.ReactNode;
  onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
  onBlur?: React.FocusEventHandler<HTMLTextAreaElement>;
  status?: SaveStatus;
  placeholder?: string;
  rows?: number;
  className?: string;
  fieldMaxWidth?: string;
  savingTitle?: string;
  errorTitle?: string;
};

export default function EditableTextareaFieldRow({
  label,
  editable,
  value,
  readOnlyValue,
  onChange,
  onBlur,
  status = null,
  placeholder,
  rows = 5,
  className = '',
  fieldMaxWidth = '100%',
  savingTitle = 'Saving',
  errorTitle = 'Save failed',
}: EditableTextareaFieldRowProps) {
  return (
    <EditableFieldRow
      label={label}
      editable={editable}
      control={(
        <Form.Control
          as="textarea"
          rows={rows}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
        />
      )}
      readOnlyValue={readOnlyValue}
      status={status}
      fieldMaxWidth={fieldMaxWidth}
      className={className}
      savingTitle={savingTitle}
      errorTitle={errorTitle}
    />
  );
}
