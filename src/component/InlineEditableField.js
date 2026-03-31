import React from 'react';
import { Form, InputGroup } from 'react-bootstrap';
import { FaCheck, FaHourglassHalf, FaTimes } from 'react-icons/fa';

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
}) {
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
              {status === 'saving' && <FaHourglassHalf className="text-muted" title="Saving" />}
              {status === 'saved' && <FaCheck className="text-success" title="Saved" />}
              {status === 'error' && <FaTimes className="text-danger" title="Save failed" />}
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
