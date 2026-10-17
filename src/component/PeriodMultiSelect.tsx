import React, { useMemo } from "react";
import { Dropdown, Form } from "react-bootstrap";
import { useIntl } from "react-intl";

import { getPeriodLabel, PERIODS, type Period } from "../util/periods";

type Props = {
  selected: readonly Period[];
  onChange: (periods: Period[]) => void;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
};

/** Compact, reusable multi-period facet for catalogue searches. */
export default function PeriodMultiSelect({
  selected,
  onChange,
  ariaLabel = "Periods",
  disabled = false,
  className = "",
}: Props) {
  const intl = useIntl();
  const chosen = useMemo(() => new Set(selected), [selected]);
  const label = selected.length
    ? selected.length === 1
      ? getPeriodLabel(intl, selected[0])
      : `${selected.length} periods`
    : "All periods";

  const toggle = (period: Period) => {
    const next = new Set(chosen);
    if (next.has(period)) next.delete(period);
    else next.add(period);
    onChange(PERIODS.filter((candidate) => next.has(candidate)));
  };

  return (
    <Dropdown className={className} autoClose="outside">
      <Dropdown.Toggle
        variant="outline-secondary"
        className="w-100 text-start d-flex align-items-center justify-content-between"
        aria-label={ariaLabel}
        disabled={disabled}
      >
        {label}
      </Dropdown.Toggle>
      <Dropdown.Menu className="p-2 period-multi-select-menu">
        {PERIODS.map((period) => (
          <Form.Check
            key={period}
            id={`period-filter-${period}`}
            type="checkbox"
            label={getPeriodLabel(intl, period)}
            checked={chosen.has(period)}
            onChange={() => toggle(period)}
            className="mb-1"
          />
        ))}
      </Dropdown.Menu>
    </Dropdown>
  );
}
