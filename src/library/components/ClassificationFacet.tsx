import React, { useState } from "react";
import { Form } from "react-bootstrap";
import { FaChevronDown, FaChevronRight } from "react-icons/fa";
import { useIntl } from "react-intl";
import {
  CLASSIFICATION_TREE,
  classificationDescendants,
  getClassificationLabel,
  type SourceClassification,
} from "../libraryShared";

const ChevronDownIcon = FaChevronDown as React.ComponentType<{
  "aria-hidden"?: boolean;
}>;
const ChevronRightIcon = FaChevronRight as React.ComponentType<{
  "aria-hidden"?: boolean;
}>;

type Props = {
  idPrefix: string;
  selected: string[];
  onChange: (values: string[]) => void;
};

/** Shared source/item hierarchy facet. Broad selections intentionally include
 * descendants in its submitted values, so old API consumers remain correct. */
export function ClassificationFacet({ idPrefix, selected, onChange }: Props) {
  const intl = useIntl();
  const [expanded, setExpanded] = useState<Set<SourceClassification>>(
    () => new Set(),
  );
  const toggle = (value: SourceClassification) => {
    const family = [value, ...classificationDescendants(value)];
    const allSelected = family.every((entry) => selected.includes(entry));
    onChange(
      allSelected
        ? selected.filter(
            (entry) => !family.includes(entry as SourceClassification),
          )
        : Array.from(new Set([...selected, ...family])),
    );
  };

  return (
    <div className="d-flex flex-column gap-2">
      {CLASSIFICATION_TREE.map(({ value, children }) => {
        const family = [value, ...classificationDescendants(value)];
        const allSelected = family.every((entry) => selected.includes(entry));
        const someSelected = family.some((entry) => selected.includes(entry));
        const isExpanded = expanded.has(value);
        return (
          <div key={value}>
            <div className="d-flex align-items-center gap-1">
              {children.length ? (
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0 text-body"
                  aria-label={`${isExpanded ? "Collapse" : "Expand"} ${getClassificationLabel(intl, value)}`}
                  onClick={() =>
                    setExpanded((current) => {
                      const next = new Set(current);
                      if (next.has(value)) next.delete(value);
                      else next.add(value);
                      return next;
                    })
                  }
                >
                  {isExpanded ? (
                    <ChevronDownIcon aria-hidden />
                  ) : (
                    <ChevronRightIcon aria-hidden />
                  )}
                </button>
              ) : (
                <span style={{ width: "1rem" }} />
              )}
              <Form.Check
                type="checkbox"
                id={`${idPrefix}-${value}`}
                label={getClassificationLabel(intl, value)}
                checked={allSelected}
                ref={(node: HTMLInputElement | null) => {
                  if (node) node.indeterminate = !allSelected && someSelected;
                }}
                onChange={() => toggle(value)}
              />
            </div>
            {isExpanded &&
              children.map((child) => (
                <div key={child} className="d-flex align-items-center gap-1">
                  <span style={{ width: "0.5rem" }} />
                  <Form.Check
                    type="checkbox"
                    id={`${idPrefix}-${child}`}
                    label={getClassificationLabel(intl, child)}
                    checked={selected.includes(child)}
                    onChange={() => toggle(child)}
                  />
                </div>
              ))}
          </div>
        );
      })}
    </div>
  );
}
