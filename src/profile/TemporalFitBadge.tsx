import React from "react";

import type { MessageFormatter, TemporalFit } from "./profileTypes";

type TemporalFitBadgeProps = {
  fit?: TemporalFit | null;
  t: MessageFormatter;
  showScore?: boolean;
};

export function temporalFitText(fit: TemporalFit | null | undefined, t: MessageFormatter) {
  if (!fit)
    return t("profile.stash.temporal.unavailable", "Temporal fit unavailable");
  if (fit.status === "NO_SOURCES")
    return t("profile.stash.temporal.noSources", "Needs sources");
  if (fit.status === "SOURCES_UNDATED")
    return t("profile.stash.temporal.undated", "Needs source dates");
  if (fit.status === "PROFILE_RANGE_UNSET")
    return t("profile.stash.temporal.profileRangeUnset", "Club range not set");
  return {
    STRONG: t("profile.stash.temporal.strong", "Strong temporal fit"),
    GOOD: t("profile.stash.temporal.good", "Good temporal fit"),
    PARTIAL: t("profile.stash.temporal.partial", "Partial temporal fit"),
    DISTANT: t("profile.stash.temporal.distant", "Distant temporal fit"),
  }[fit.status];
}

export default function TemporalFitBadge({
  fit,
  t,
  showScore = false,
}: TemporalFitBadgeProps) {
  const text = temporalFitText(fit, t);
  const score = showScore && fit?.score != null ? ` (${fit.score}%)` : "";
  const state = (fit?.status || "UNAVAILABLE").toLowerCase().replaceAll("_", "-");
  return (
    <span className={`stash-temporal-fit stash-temporal-fit--${state}`} title={text}>
      {text}{score}
    </span>
  );
}
