import React, { useEffect, useId, useRef, useState } from "react";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";

type OnDemandPanelProps = {
  title: string;
  description?: string;
  className?: string;
  onOpen?: () => void;
  /** Keep full profile content visible on desktop while preserving the mobile
   * disclosure that prevents a long page from mounting every feed at once. */
  collapseOnMobile?: boolean;
  /** Open a collapsed panel for a direct handoff, such as a prepared post. */
  forceOpen?: boolean;
  children: React.ReactNode;
};

/**
 * Prevents secondary feeds from issuing requests or constructing DOM until a
 * visitor explicitly asks for them. Entity pages can contain many independent
 * feeds, so mounting all of them is disproportionately expensive.
 */
export default function OnDemandPanel({
  title,
  description,
  className = "",
  onOpen,
  collapseOnMobile = false,
  forceOpen = false,
  children,
}: OnDemandPanelProps) {
  const [open, setOpen] = useState(
    () => forceOpen || (collapseOnMobile && !isNarrowViewport()),
  );
  const [hasOpened, setHasOpened] = useState(open);
  const contentId = useId();
  const notifiedOpen = useRef(false);
  useEffect(() => {
    if (forceOpen) {
      setHasOpened(true);
      setOpen(true);
    }
  }, [forceOpen]);
  useEffect(() => {
    if (!open || notifiedOpen.current) return;
    notifiedOpen.current = true;
    onOpen?.();
  }, [onOpen, open]);
  return (
    <section className={`on-demand-panel ${className}`.trim()}>
      {(!open || collapseOnMobile) && (
        <button
          type="button"
          className={`btn btn-outline-secondary w-100 text-start${open ? " d-md-none mb-2" : ""}`}
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => {
            setHasOpened(true);
            setOpen(!open);
          }}
        >
          <span className="d-flex align-items-center justify-content-between gap-2">
            <span className="fw-semibold">{title}</span>
            {open ? <FaChevronUp aria-hidden="true" /> : <FaChevronDown aria-hidden="true" />}
          </span>
          {!open && description && <span className="d-block small text-muted">{description}</span>}
        </button>
      )}
      <div id={contentId} hidden={!open}>
        {hasOpened && children}
      </div>
    </section>
  );
}

function isNarrowViewport() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 767.98px)").matches
  );
}
