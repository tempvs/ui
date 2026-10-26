import React from "react";
import { Form } from "react-bootstrap";

export type ResultSortOption = {
  value: string;
  label: string;
};

type ResultSortSelectProps = {
  value: string;
  options: readonly ResultSortOption[];
  ariaLabel: string;
  onChange: (value: string) => void;
};

/** A compact, consistent sort control for catalogue and search results. */
export default function ResultSortSelect({
  value,
  options,
  ariaLabel,
  onChange,
}: ResultSortSelectProps) {
  return (
    <Form.Select
      size="sm"
      value={value}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Form.Select>
  );
}
