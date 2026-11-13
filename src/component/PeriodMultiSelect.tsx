import React, { useId, useMemo } from "react";
import { Dropdown, Form, OverlayTrigger, Tooltip } from "react-bootstrap";
import { useIntl } from "react-intl";

import { getPeriodLabel, getPeriodOptionLabel, getPeriodRangeLabel, PERIODS, type Period } from "../util/periods";

type Props = {
  selected: readonly Period[];
  onChange: (periods: Period[]) => void;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
  /** Render choices directly when a search sidebar has room for them. */
  display?: "dropdown" | "checkboxes";
  /** Editing forms show date guidance; search filters keep period names only. */
  includeRanges?: boolean;
  showRangeTooltips?: boolean;
};

/** Compact, reusable multi-period facet for catalogue searches. */
export default function PeriodMultiSelect({
  selected,
  onChange,
  ariaLabel = "Periods",
  disabled = false,
  className = "",
  display = "dropdown",
  includeRanges = false,
  showRangeTooltips = false,
}: Props) {
  const intl = useIntl();
  const tooltipId = useId();
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

  const options = (
    <>
      {PERIODS.map((period) => {
        const check = <Form.Check
          id={`period-filter-${ariaLabel.replace(/[^a-z0-9]+/gi, "-")}-${period}`}
          type="checkbox"
          label={includeRanges ? getPeriodOptionLabel(intl, period) : getPeriodLabel(intl, period)}
          checked={chosen.has(period)}
          disabled={disabled}
          onChange={() => toggle(period)}
          className="mb-1"
        />;
        return showRangeTooltips ? (
          <OverlayTrigger
            key={period}
            trigger={["hover", "focus"]}
            placement="right"
            popperConfig={{ modifiers: [{ name: "offset", options: { offset: [0, 4] } }] }}
            delay={{ show: 200, hide: 0 }}
            overlay={<Tooltip id={`${tooltipId}-${period}`}>{getPeriodRangeLabel(intl, period)}</Tooltip>}
          >
            <div style={{ width: "fit-content", maxWidth: "100%", paddingInlineEnd: "3ch" }}>{check}</div>
          </OverlayTrigger>
        ) : <React.Fragment key={period}>{check}</React.Fragment>;
      })}
    </>
  );

  if (display === "checkboxes") {
    return (
      <fieldset
        className={`period-multi-select-checkboxes ${className}`.trim()}
      >
        <legend className="period-multi-select-checkboxes-label">
          {ariaLabel}
        </legend>
        {options}
      </fieldset>
    );
  }

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
        {options}
      </Dropdown.Menu>
    </Dropdown>
  );
}
