import React from 'react';
import { Form } from 'react-bootstrap';

type TextFilterInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel?: string;
  className?: string;
  size?: 'sm' | 'lg';
  disabled?: boolean;
};

/** A controlled text field for filtering the list currently shown on a page. */
export default function TextFilterInput({
  value,
  onChange,
  placeholder,
  ariaLabel = placeholder,
  className,
  size = 'sm',
  disabled = false,
}: TextFilterInputProps) {
  return (
    <Form.Control
      type="search"
      size={size}
      value={value}
      onChange={event => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      disabled={disabled}
      className={className}
    />
  );
}
