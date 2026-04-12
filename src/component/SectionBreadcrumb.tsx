import React from 'react';
import { Dropdown } from 'react-bootstrap';
import { Link } from 'react-router-dom';

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

function BreadcrumbSwitcher({ switcher }: BreadcrumbSwitcherProps) {
  if (!switcher) {
    return null;
  }

  return (
    <Dropdown align="end">
      <Dropdown.Toggle
        variant="link"
        size="sm"
        className="p-0 text-decoration-none"
        style={{ color: '#000' }}
        id={switcher.id}
      />
      <Dropdown.Menu>
        {switcher.items?.length ? switcher.items.map(entry => (
          entry.to ? (
            <Dropdown.Item
              as={Link}
              key={entry.key || String(entry.label)}
              to={entry.to}
              active={entry.active}
              disabled={entry.disabled}
              onClick={entry.onClick}
            >
              {entry.label}
            </Dropdown.Item>
          ) : (
            <Dropdown.Item
              as="button"
              key={entry.key || String(entry.label)}
              href={entry.href}
              active={entry.active}
              disabled={entry.disabled}
              onClick={entry.onClick}
            >
              {entry.label}
            </Dropdown.Item>
          )
        )) : (
          <Dropdown.Item disabled>{switcher.emptyLabel || 'No options'}</Dropdown.Item>
        )}
      </Dropdown.Menu>
    </Dropdown>
  );
}

export default function SectionBreadcrumb({ items = [], switcher = null, className = '' }: SectionBreadcrumbProps) {
  const visibleItems = items.filter((item): item is SectionBreadcrumbItem => Boolean(item?.label));

  if (!visibleItems.length && !switcher) {
    return null;
  }

  return (
    <div className={`d-flex align-items-center gap-2 flex-wrap small ${className}`.trim()}>
      {visibleItems.map((item, index) => (
        <React.Fragment key={`${String(item.label)}-${index}`}>
          {index > 0 && <span>&gt;</span>}
          <div className="d-inline-flex align-items-center gap-1">
            {item.to ? (
              <Link to={item.to} className="text-decoration-underline">
                {item.label}
              </Link>
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
