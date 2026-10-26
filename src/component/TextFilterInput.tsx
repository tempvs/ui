import React from "react";
import { Form } from "react-bootstrap";

type TextFilterInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel?: string;
  className?: string;
  size?: "sm" | "lg";
  disabled?: boolean;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
};

/** A controlled text field for filtering the list currently shown on a page. */
const TextFilterInput = React.forwardRef<
  HTMLInputElement,
  TextFilterInputProps
>(
  (
    {
      value,
      onChange,
      placeholder,
      ariaLabel = placeholder,
      className,
      size = "sm",
      disabled = false,
      onFocus,
    },
    ref,
  ) => (
    <Form.Control
      ref={ref}
      type="search"
      size={size}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      disabled={disabled}
      onFocus={onFocus}
      className={className}
    />
  ),
);

TextFilterInput.displayName = "TextFilterInput";

export default TextFilterInput;
