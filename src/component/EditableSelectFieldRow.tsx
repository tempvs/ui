import React from 'react';
import { Form } from 'react-bootstrap';

import EditableFieldRow, { SaveStatus } from './EditableFieldRow';

type EditableSelectOption = {
  value: string | number;
  label: React.ReactNode;
  readOnlyLabel?: React.ReactNode;
};

type SelectFieldControlProps = {
  value?: string | number | string[];
  options: EditableSelectOption[];
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  onBlur?: React.FocusEventHandler<HTMLSelectElement>;
  autoFocus?: boolean;
  className?: string;
  readOnly?: boolean;
  disabled?: boolean;
};

function SelectFieldControl({ options, readOnly, disabled, ...props }: SelectFieldControlProps) {
  return (
    <Form.Select size="sm" {...props} disabled={readOnly || disabled}>
      {options.map(option => (
        <option key={option.value} value={option.value}>
          {readOnly ? option.readOnlyLabel ?? option.label : option.label}
        </option>
      ))}
    </Form.Select>
  );
}

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
  labelWidth?: string;
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
  labelWidth,
  savingTitle = 'Saving',
  errorTitle = 'Save failed',
}: EditableSelectFieldRowProps) {
  return (
    <EditableFieldRow
      label={label}
      editable={editable}
      control={(
        <SelectFieldControl
          value={value}
          options={options}
          onChange={onChange}
          onBlur={onBlur}
        />
      )}
      status={status}
      readOnlyValue={readOnlyValue}
      fieldMaxWidth={fieldMaxWidth}
      labelWidth={labelWidth}
      className={className}
      savingTitle={savingTitle}
      errorTitle={errorTitle}
    />
  );
}
