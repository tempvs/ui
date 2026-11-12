import React, { useEffect, useRef, useState } from "react";
import "./OnboardingProgress.css";

export function onboardingProgress(completed: number, total: number) {
  if (!Number.isFinite(total) || total < 1) return null;
  const count = Math.floor(total);
  const done = Number.isFinite(completed) ? Math.min(count, Math.max(0, Math.floor(completed))) : 0;
  return {
    completed: done,
    total: count,
    percentage: done === count ? 100 : Math.min(99, Math.round(done / count * 100)),
  };
}

export default function OnboardingProgress({
  completed,
  total,
  label,
  countLabel,
  status = "ready",
  compact = false,
}: {
  completed: number;
  total: number;
  label: string;
  countLabel: string;
  status?: "ready" | "loading" | "unavailable";
  compact?: boolean;
}) {
  const progress = status === "ready" ? onboardingProgress(completed, total) : null;
  const text = progress
    ? `${progress.percentage}% complete · ${progress.completed} of ${progress.total} ${countLabel}`
    : "";
  const previous = useRef({ label, text });
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    if (previous.current.label === label && previous.current.text && text && previous.current.text !== text)
      setAnnouncement(`${label}: ${text}`);
    previous.current = { label, text };
  }, [label, text]);
  return (
    <div className={`onboarding-progress${compact ? " onboarding-progress--compact" : ""}`}>
      {progress ? (
        <>
          <div className="onboarding-progress-copy">
            <strong>{progress.percentage}% complete</strong>
            <span aria-hidden="true"> · </span>
            <span>{progress.completed} of {progress.total} {countLabel}</span>
          </div>
          <div className="onboarding-progress-track" role="progressbar" aria-label={label}
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percentage}
            aria-valuetext={`${progress.completed} of ${progress.total} ${countLabel}, ${progress.percentage} percent`}>
            <span style={{ width: `${progress.percentage}%` }} />
          </div>
        </>
      ) : (
        <p className="onboarding-progress-state" role="status">
          {status === "loading" ? `Loading ${label} progress…` : `${label} progress is unavailable.`}
        </p>
      )}
      <span className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">{announcement}</span>
    </div>
  );
}
