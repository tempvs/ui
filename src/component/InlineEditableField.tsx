import React from 'react';
import { Form, InputGroup } from 'react-bootstrap';
import { FaCheck, FaHourglassHalf, FaTimes } from 'react-icons/fa';

import { SaveStatus } from './EditableFieldRow';

type InlineEditableFieldProps = {
  editable: boolean;
  label?: React.ReactNode;
  controlId?: string;
  status?: SaveStatus;
  className?: string;
  readOnlyClassName?: string;
  inputGroupClassName?: string;
  readOnlyValue?: React.ReactNode;
  renderReadOnly?: () => React.ReactNode;
  renderControl?: () => React.ReactNode;
};

type StatusIconProps = {
  className?: string;
  title?: string;
};

const CheckIcon = FaCheck as React.ComponentType<StatusIconProps>;
const SavingIcon = FaHourglassHalf as React.ComponentType<StatusIconProps>;
const ErrorIcon = FaTimes as React.ComponentType<StatusIconProps>;

function InlineEditableField({
  editable,
  label,
  controlId,
  status,
  className,
  readOnlyClassName,
  inputGroupClassName,
  readOnlyValue,
  renderReadOnly,
  renderControl,
}: InlineEditableFieldProps) {
  const resolvedReadOnly = renderReadOnly
    ? renderReadOnly()
    : <div className={readOnlyClassName}>{readOnlyValue}</div>;

  const resolvedControl = renderControl ? renderControl() : null;

  return (
    <Form.Group controlId={controlId} className={className}>
      {label && <Form.Label>{label}</Form.Label>}
      {editable ? (
        <InputGroup className={inputGroupClassName}>
          {resolvedControl}
          {(status === 'saving' || status === 'saved' || status === 'error') && (
            <InputGroup.Text>
              {status === 'saving' && <SavingIcon className="text-muted" title="Saving" />}
              {status === 'saved' && <CheckIcon className="text-success" title="Saved" />}
              {status === 'error' && <ErrorIcon className="text-danger" title="Save failed" />}
            </InputGroup.Text>
          )}
        </InputGroup>
      ) : (
        resolvedReadOnly
      )}
    </Form.Group>
  );
}

export default InlineEditableField;
