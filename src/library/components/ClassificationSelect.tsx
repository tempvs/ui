import { CSSProperties } from "react";
import { Form } from "react-bootstrap";
import { useIntl } from "react-intl";

import { CLASSIFICATION_TREE, getClassificationLabel } from "../libraryShared";

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
  const intl = useIntl();

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
          {getClassificationLabel(intl, parent)}
        </option>,
        ...children.map((child) => (
          <option key={child} value={child}>
            {`↳ ${getClassificationLabel(intl, child)}`}
          </option>
        )),
      ])}
    </Form.Select>
  );
}
