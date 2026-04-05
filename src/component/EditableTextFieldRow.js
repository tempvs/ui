import React from 'react';
import { Form } from 'react-bootstrap';

import EditableFieldRow from './EditableFieldRow';

export default function EditableTextFieldRow({
  label,
  editable,
  value,
  readOnlyValue,
  onChange,
  onBlur,
  status = null,
  placeholder,
  type = 'text',
  className = 'mb-2',
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
          type={type}
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
