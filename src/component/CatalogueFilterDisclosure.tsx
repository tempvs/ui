import React from "react";
import { Button } from "react-bootstrap";

import "./catalogueSearch.css";

type CatalogueFilterDisclosureProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasActiveFilters: boolean;
  activeCount?: number;
  inactiveSummary: string;
  children: React.ReactNode;
  onClearFilters: () => void;
  className?: string;
};

/** Shared filter disclosure for catalogue pages. */
export default function CatalogueFilterDisclosure({
  open,
  onOpenChange,
  hasActiveFilters,
  activeCount = 0,
  inactiveSummary,
  children,
  onClearFilters,
  className = "",
}: CatalogueFilterDisclosureProps) {
  return (
    <details
      className={`catalogue-filter-disclosure ${className}`.trim()}
      open={open}
      onToggle={(event) =>
        onOpenChange((event.currentTarget as HTMLDetailsElement).open)
      }
    >
      <summary>
        Filters{hasActiveFilters && activeCount > 0 ? ` (${activeCount})` : ""}
      </summary>
      <div className="catalogue-filter-disclosure-content">
        <div className="catalogue-filter-disclosure-actions">
          <span className="small text-muted">
            {hasActiveFilters ? "Filters applied" : inactiveSummary}
          </span>
          {hasActiveFilters && (
            <Button variant="link" size="sm" onClick={onClearFilters}>
              Clear filters
            </Button>
          )}
        </div>
        {children}
      </div>
    </details>
  );
}
