import React from 'react';

import { SaveStatus } from './EditableFieldRow';
import InlineEditableText from './InlineEditableText';

type EditableDescriptionFieldProps = {
  label?: React.ReactNode;
  editable: boolean;
  value?: string;
  readOnlyValue: string;
  onValueChange?: (value: string) => void;
  onBlur?: () => void;
  status?: SaveStatus;
  placeholderDisplay?: boolean;
  placeholder?: string;
  className?: string;
  textClassName?: string;
  rows?: number;
  multilineUseContentEditable?: boolean;
  savingTitle?: string;
  errorTitle?: string;
};

export default function EditableDescriptionField({
  label,
  editable,
  value = '',
  readOnlyValue,
  onValueChange,
  onBlur,
  status,
  placeholderDisplay = false,
  placeholder = 'No description',
  className = '',
  textClassName = 'stash-item-description',
  rows = 4,
  multilineUseContentEditable = false,
  savingTitle = 'Saving',
  errorTitle = 'Save failed',
}: EditableDescriptionFieldProps) {
  const field = (
    <InlineEditableText
      editable={editable}
      value={value}
      readOnlyValue={readOnlyValue}
      onValueChange={onValueChange}
      onBlur={onBlur}
      status={status}
      textClassName={textClassName}
      placeholderDisplay={placeholderDisplay}
      placeholder={placeholder}
      popoverValue={placeholderDisplay ? undefined : readOnlyValue}
      multiline
      multilineUseContentEditable={multilineUseContentEditable}
      multilineRows={rows}
      className={label !== undefined && label !== null ? '' : className}
      savingTitle={savingTitle}
      errorTitle={errorTitle}
    />
  );

  return label !== undefined && label !== null ? (
    <div className={`d-flex align-items-start gap-3 mb-2 ${className}`.trim()}>
      <div className="text-start small fw-semibold" style={{ width: '7rem' }}>{label}</div>
      <div className="flex-grow-1 min-width-0">{field}</div>
    </div>
  ) : field;
}
