import React from 'react';
import { Form } from 'react-bootstrap';

import EditableFieldRow, { SaveStatus } from './EditableFieldRow';

type EditableSelectOption = {
  value: string | number;
  label: React.ReactNode;
};

type EditableSelectFieldRowProps = {
  label?: React.ReactNode;
  editable: boolean;
  value?: string | number | string[];
  readOnlyValue?: React.ReactNode;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  onBlur?: React.FocusEventHandler<HTMLSelectElement>;
  status?: SaveStatus;
  options: EditableSelectOption[];
  className?: string;
  fieldMaxWidth?: string;
  savingTitle?: string;
  errorTitle?: string;
};

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
}: EditableSelectFieldRowProps) {
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
