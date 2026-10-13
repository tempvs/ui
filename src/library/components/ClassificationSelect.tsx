import { CSSProperties } from "react";
import { Form } from "react-bootstrap";

import {
  CLASSIFICATION_TREE,
  getClassificationDefaultLabel,
} from "../libraryShared";

type ClassificationSelectProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  size?: "sm" | "lg";
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
};

/**
 * Shared single-value classification picker. Keeping its hierarchy in one
 * place prevents source, item, map, and review filters drifting apart.
 */
export function ClassificationSelect({
  value,
  onChange,
  placeholder,
  required,
  size,
  ariaLabel,
  className,
  style,
}: ClassificationSelectProps) {
  return (
    <Form.Select
      required={required}
      size={size}
      aria-label={ariaLabel}
      className={className}
      style={style}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {CLASSIFICATION_TREE.flatMap(({ value: parent, children }) => [
        <option key={parent} value={parent}>
          {getClassificationDefaultLabel(parent)}
        </option>,
        ...children.map((child) => (
          <option key={child} value={child}>
            {`↳ ${getClassificationDefaultLabel(child)}`}
          </option>
        )),
      ])}
    </Form.Select>
  );
}
