import React, { useState } from "react";
import { Form } from "react-bootstrap";
import type { FormSelectProps } from "react-bootstrap/FormSelect";
import "./optionLabelSelect.css";

export type SelectLabelOption = {
  value: string | number;
  label: React.ReactNode;
  readOnlyLabel?: React.ReactNode;
};

type Props = Omit<FormSelectProps, "children"> & {
  options: SelectLabelOption[];
};

/** Keep native selection, validation, and form submission while displaying a
 * shorter selected label. The native popup retains the full option labels. */
export default function OptionLabelSelect({ options, value, defaultValue, onChange, className = "", size, ...props }: Props) {
  const [selected, setSelected] = useState(defaultValue ?? "");
  const current = value ?? selected;
  const option = options.find(entry => String(entry.value) === String(current));
  const displayClass = `form-select${size ? ` form-select-${size}` : ""} ${className}`;

  return (
    <div className="option-label-select">
      <Form.Select
        {...props}
        className={className}
        size={size}
        value={value}
        defaultValue={defaultValue}
        onChange={event => {
          setSelected(event.target.value);
          onChange?.(event);
        }}
      >
        {options.map(entry => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
      </Form.Select>
      <span className={`${displayClass} option-label-select-value`} aria-hidden="true">
        {option?.readOnlyLabel ?? option?.label}
      </span>
    </div>
  );
}
