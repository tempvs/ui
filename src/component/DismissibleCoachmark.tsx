import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FaTimes } from "react-icons/fa";

type DismissibleCoachmarkProps = {
  id: string;
  message: string;
  visible: boolean;
  children: React.ReactNode;
  className?: string;
};

type CoachmarkPosition = {
  left: number;
  top: number;
  pointerTop: number;
  side: "left" | "right";
};

const CloseIcon = FaTimes as React.ComponentType<{ "aria-hidden"?: boolean }>;

/** A one-session, dismissible hint anchored to the action it describes. */
export default function DismissibleCoachmark({
  id,
  message,
  visible,
  children,
  className,
}: DismissibleCoachmarkProps) {
  const storageKey = `tempvs:coachmark:${id}`;
  const anchorRef = useRef<HTMLSpanElement>(null);
  const coachmarkRef = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<CoachmarkPosition | null>(null);
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
  const shown = visible && !dismissed;

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    const coachmark = coachmarkRef.current;
    if (!anchor || !coachmark) return;

    const anchorRect = anchor.getBoundingClientRect();
    const coachmarkRect = coachmark.getBoundingClientRect();
    const margin = 12;
    const gap = 10;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const prefersRight = anchorRect.left + anchorRect.width / 2 <= viewportWidth / 2;
    const rightLeft = anchorRect.right + gap;
    const leftLeft = anchorRect.left - coachmarkRect.width - gap;
    let side: CoachmarkPosition["side"] = prefersRight ? "right" : "left";

    // Keep the hint facing inward whenever possible, only reversing near a viewport edge.
    if (side === "right" && rightLeft + coachmarkRect.width > viewportWidth - margin && leftLeft >= margin) {
      side = "left";
    } else if (side === "left" && leftLeft < margin && rightLeft + coachmarkRect.width <= viewportWidth - margin) {
      side = "right";
    }

    const desiredLeft = side === "right" ? rightLeft : leftLeft;
    const left = Math.max(margin, Math.min(desiredLeft, viewportWidth - coachmarkRect.width - margin));
    const desiredTop = anchorRect.top + anchorRect.height / 2 - coachmarkRect.height / 2;
    const top = Math.max(margin, Math.min(desiredTop, viewportHeight - coachmarkRect.height - margin));
    const pointerTop = Math.max(
      14,
      Math.min(anchorRect.top + anchorRect.height / 2 - top, coachmarkRect.height - 14),
    );

    setPosition((current) => {
      const next = { left, top, pointerTop, side };
      if (
        current &&
        current.side === next.side &&
        Math.abs(current.left - next.left) < 1 &&
        Math.abs(current.top - next.top) < 1 &&
        Math.abs(current.pointerTop - next.pointerTop) < 1
      ) {
        return current;
      }
      return next;
    });
  }, []);

  useLayoutEffect(() => {
    if (!shown) {
      setPosition(null);
      return undefined;
    }

    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);
    const onViewportChange = () => updatePosition();
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(updatePosition);
    if (anchorRef.current) observer?.observe(anchorRef.current);
    if (coachmarkRef.current) observer?.observe(coachmarkRef.current);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
      observer?.disconnect();
    };
  }, [shown, updatePosition]);

  return (
    <span ref={anchorRef} className={`coachmark-anchor${className ? ` ${className}` : ""}`}>
      {children}
      {shown && typeof document !== "undefined" &&
        createPortal(
          <span
            ref={coachmarkRef}
            className={`dismissible-coachmark dismissible-coachmark--${position?.side ?? "right"}`}
            style={{
              left: position?.left ?? 0,
              top: position?.top ?? 0,
              "--coachmark-pointer-top": `${position?.pointerTop ?? 16}px`,
              visibility: position ? "visible" : "hidden",
            } as React.CSSProperties}
            role="status"
          >
            <span>{message}</span>
            <button type="button" onClick={close} aria-label="Dismiss hint" title="Dismiss hint">
              <CloseIcon aria-hidden />
            </button>
          </span>,
          document.body,
        )}
    </span>
  );
}
