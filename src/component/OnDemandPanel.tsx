import React, { useEffect, useRef, useState } from "react";

type OnDemandPanelProps = {
  title: string;
  description?: string;
  className?: string;
  onOpen?: () => void;
  /** Keep full profile content visible on desktop while preserving the mobile
   * disclosure that prevents a long page from mounting every feed at once. */
  collapseOnMobile?: boolean;
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
  children,
}: OnDemandPanelProps) {
  const [open, setOpen] = useState(
    () => collapseOnMobile && !isNarrowViewport(),
  );
  const notifiedOpen = useRef(false);
  useEffect(() => {
    if (!open || notifiedOpen.current) return;
    notifiedOpen.current = true;
    onOpen?.();
  }, [onOpen, open]);
  return (
    <section className={`on-demand-panel ${className}`.trim()}>
      {!open ? (
        <button
          type="button"
          className="btn btn-outline-secondary w-100 text-start"
          onClick={() => {
            setOpen(true);
          }}
        >
          <span className="fw-semibold">{title}</span>
          {description && <span className="d-block small text-muted">{description}</span>}
        </button>
      ) : (
        children
      )}
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
