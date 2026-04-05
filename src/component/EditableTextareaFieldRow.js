import React from 'react';
import { Form } from 'react-bootstrap';

import EditableFieldRow from './EditableFieldRow';

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
}) {
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
