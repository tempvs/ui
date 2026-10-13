import React from "react";
import { FormattedMessage } from "react-intl";
import { FaHourglassHalf } from "react-icons/fa";

const HourglassIcon = FaHourglassHalf as React.ComponentType<{
  "aria-hidden"?: boolean;
}>;

type SpinnerProps = {
  size?: string;
};

export default function Spinner({ size = "50px" }: SpinnerProps) {
  const isSmall = size === "sm";
  const resolvedSize = isSmall ? "14px" : size;

  return (
    <FormattedMessage id="loading" defaultMessage="Loading">
      {(label) => {
        const labelText = Array.isArray(label) ? label.join("") : String(label);

        return (
          <span
            className="tempvs-hourglass-spinner d-inline-flex align-items-center justify-content-center"
            aria-label={labelText}
            title={labelText}
            style={{ fontSize: resolvedSize }}
          >
            <HourglassIcon aria-hidden />
          </span>
        );
      }}
    </FormattedMessage>
  );
}
