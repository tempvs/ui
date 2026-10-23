import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

export type SectionBreadcrumbSwitcherItem = {
  key?: React.Key;
  label?: React.ReactNode;
  to?: string;
  href?: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLElement>;
};

export type SectionBreadcrumbSwitcher = {
  id: string;
  emptyLabel?: React.ReactNode;
  items?: SectionBreadcrumbSwitcherItem[];
};

export type SectionBreadcrumbItem = {
  label?: React.ReactNode;
  to?: string;
  href?: string;
  switcher?: SectionBreadcrumbSwitcher | null;
};

type BreadcrumbSwitcherProps = {
  switcher?: SectionBreadcrumbSwitcher | null;
};

type SectionBreadcrumbProps = {
  items?: Array<SectionBreadcrumbItem | null | undefined>;
  switcher?: SectionBreadcrumbSwitcher | null;
  className?: string;
};

function isInternalPath(value?: string): value is string {
  return Boolean(value?.startsWith("/") && !value.startsWith("//"));
}

function BreadcrumbSwitcher({ switcher }: BreadcrumbSwitcherProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!switcher) {
    return null;
  }

  return (
    <div ref={rootRef} className="dropdown position-relative">
      <button
        type="button"
        className="btn btn-link btn-sm p-0 text-decoration-none dropdown-toggle"
        style={{ color: "#000" }}
        id={switcher.id}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      />
      {open && (
        <div
          className="dropdown-menu dropdown-menu-end show"
          role="menu"
          aria-labelledby={switcher.id}
        >
          {switcher.items?.length ? (
            switcher.items.map((entry) =>
              entry.to ? (
                <Link
                  className={`dropdown-item${entry.active ? " active" : ""}${entry.disabled ? " disabled" : ""}`}
                  key={entry.key || String(entry.label)}
                  to={entry.to}
                  aria-disabled={entry.disabled || undefined}
                  onClick={(event) => {
                    setOpen(false);
                    entry.onClick?.(event);
                  }}
                >
                  {entry.label}
                </Link>
              ) : isInternalPath(entry.href) ? (
                <Link
                  className={`dropdown-item${entry.active ? " active" : ""}${entry.disabled ? " disabled" : ""}`}
                  key={entry.key || String(entry.label)}
                  to={entry.href}
                  aria-disabled={entry.disabled || undefined}
                  onClick={(event) => {
                    setOpen(false);
                    entry.onClick?.(event);
                  }}
                >
                  {entry.label}
                </Link>
              ) : entry.href ? (
                <a
                  className={`dropdown-item${entry.active ? " active" : ""}${entry.disabled ? " disabled" : ""}`}
                  key={entry.key || String(entry.label)}
                  href={entry.href}
                  aria-disabled={entry.disabled || undefined}
                  onClick={(event) => {
                    setOpen(false);
                    entry.onClick?.(event);
                  }}
                >
                  {entry.label}
                </a>
              ) : (
                <button
                  type="button"
                  className={`dropdown-item${entry.active ? " active" : ""}`}
                  key={entry.key || String(entry.label)}
                  disabled={entry.disabled}
                  onClick={(event) => {
                    setOpen(false);
                    entry.onClick?.(event);
                  }}
                >
                  {entry.label}
                </button>
              ),
            )
          ) : (
            <span className="dropdown-item disabled">
              {switcher.emptyLabel || "No options"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function SectionBreadcrumb({
  items = [],
  switcher = null,
  className = "",
}: SectionBreadcrumbProps) {
  const visibleItems = items.filter((item): item is SectionBreadcrumbItem =>
    Boolean(item?.label),
  );

  if (!visibleItems.length && !switcher) {
    return null;
  }

  return (
    <div
      className={`d-flex align-items-center gap-2 flex-wrap fs-6 fw-normal ${className}`.trim()}
    >
      {visibleItems.map((item, index) => (
        <React.Fragment key={`${String(item.label)}-${index}`}>
          {index > 0 && <span>&gt;</span>}
          <div className="d-inline-flex align-items-center gap-1">
            {item.to ? (
              <Link to={item.to} className="text-decoration-underline">
                {item.label}
              </Link>
            ) : isInternalPath(item.href) ? (
              <Link to={item.href} className="text-decoration-underline">
                {item.label}
              </Link>
            ) : item.href ? (
              <a href={item.href} className="text-decoration-underline">
                {item.label}
              </a>
            ) : (
              <span>{item.label}</span>
            )}
            <BreadcrumbSwitcher switcher={item.switcher} />
          </div>
        </React.Fragment>
      ))}
      <BreadcrumbSwitcher switcher={switcher} />
    </div>
  );
}
