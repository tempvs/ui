import type { ComponentType } from "react";
import { FaHourglassHalf } from "react-icons/fa";

const HourglassIcon = FaHourglassHalf as ComponentType<{
  "aria-hidden"?: boolean;
}>;

type SpinnerProps = {
  size?: string;
};

export default function Spinner({ size = "50px" }: SpinnerProps) {
  const isSmall = size === "sm";
  const resolvedSize = isSmall ? "14px" : size;

  return (
    <span
      className="tempvs-hourglass-spinner d-inline-flex align-items-center justify-content-center"
      role="status"
      aria-label="Loading"
      title="Loading"
      style={{ fontSize: resolvedSize }}
    >
      <HourglassIcon aria-hidden />
    </span>
  );
}
