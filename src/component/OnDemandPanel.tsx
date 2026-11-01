import React, { useState } from "react";

type OnDemandPanelProps = {
  title: string;
  description?: string;
  className?: string;
  onOpen?: () => void;
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
  children,
}: OnDemandPanelProps) {
  const [open, setOpen] = useState(false);
  return (
    <section className={`on-demand-panel ${className}`.trim()}>
      {!open ? (
        <button
          type="button"
          className="btn btn-outline-secondary w-100 text-start"
          onClick={() => {
            setOpen(true);
            onOpen?.();
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
