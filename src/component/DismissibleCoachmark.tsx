import React, { useState } from "react";
import { FaTimes } from "react-icons/fa";

type DismissibleCoachmarkProps = {
  id: string;
  message: string;
  visible: boolean;
  children: React.ReactNode;
  placement?: "top" | "bottom";
  className?: string;
};

const CloseIcon = FaTimes as React.ComponentType<{ "aria-hidden"?: boolean }>;

/** A one-session, dismissible hint anchored to the action it describes. */
export default function DismissibleCoachmark({
  id,
  message,
  visible,
  children,
  placement = "bottom",
  className,
}: DismissibleCoachmarkProps) {
  const storageKey = `tempvs:coachmark:${id}`;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.sessionStorage.getItem(storageKey) === "dismissed";
    } catch {
      return false;
    }
  });
  const close = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(storageKey, "dismissed");
    } catch {
      // The hint remains dismissible even where browser storage is unavailable.
    }
  };

  return (
    <span className={`coachmark-anchor${className ? ` ${className}` : ""}`}>
      {children}
      {visible && !dismissed && (
        <span className={`dismissible-coachmark dismissible-coachmark--${placement}`} role="status">
          <span>{message}</span>
          <button type="button" onClick={close} aria-label="Dismiss hint" title="Dismiss hint">
            <CloseIcon aria-hidden />
          </button>
        </span>
      )}
    </span>
  );
}
