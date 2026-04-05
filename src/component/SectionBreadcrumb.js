import React from 'react';
import { Dropdown } from 'react-bootstrap';
import { Link } from 'react-router-dom';

function BreadcrumbSwitcher({ switcher }) {
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
          <Dropdown.Item
            as={entry.to ? Link : 'button'}
            key={entry.key || entry.label}
            to={entry.to}
            href={entry.href}
            active={entry.active}
            disabled={entry.disabled}
            onClick={entry.onClick}
          >
            {entry.label}
          </Dropdown.Item>
        )) : (
          <Dropdown.Item disabled>{switcher.emptyLabel || 'No options'}</Dropdown.Item>
        )}
      </Dropdown.Menu>
    </Dropdown>
  );
}

export default function SectionBreadcrumb({ items = [], switcher = null, className = '' }) {
  const visibleItems = items.filter(item => item?.label);

  if (!visibleItems.length && !switcher) {
    return null;
  }

  return (
    <div className={`d-flex align-items-center gap-2 flex-wrap small ${className}`.trim()}>
      {visibleItems.map((item, index) => (
        <React.Fragment key={`${item.label}-${index}`}>
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
