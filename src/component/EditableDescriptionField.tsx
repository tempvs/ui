import React from 'react';

import { SaveStatus } from './EditableFieldRow';
import InlineEditableText from './InlineEditableText';

type EditableDescriptionFieldProps = {
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
  savingTitle?: string;
  errorTitle?: string;
};

export default function EditableDescriptionField({
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
  savingTitle = 'Saving',
  errorTitle = 'Save failed',
}: EditableDescriptionFieldProps) {
  return (
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
      multilineRows={rows}
      className={className}
      savingTitle={savingTitle}
      errorTitle={errorTitle}
    />
  );
}
