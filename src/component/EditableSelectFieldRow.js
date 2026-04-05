import React from 'react';
import { Form } from 'react-bootstrap';

import EditableFieldRow from './EditableFieldRow';

export default function EditableSelectFieldRow({
  label,
  editable,
  value,
  readOnlyValue,
  onChange,
  onBlur,
  status = null,
  options,
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
        <Form.Select
          size="sm"
          value={value}
          onChange={onChange}
          onBlur={onBlur}
        >
          {options.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </Form.Select>
      )}
      status={status}
      readOnlyValue={readOnlyValue}
      fieldMaxWidth={fieldMaxWidth}
      className={className}
      savingTitle={savingTitle}
      errorTitle={errorTitle}
    />
  );
}
