import React from 'react';
import { Dropdown } from 'react-bootstrap';
import { useIntl } from 'react-intl';
import { Link } from 'react-router-dom';

import { getPeriodLabel, PERIODS } from '../libraryShared';

export default function LibraryPeriodBreadcrumb({ period, variant = 'period' }) {
  const intl = useIntl();

  if (!period) {
    return null;
  }

  return (
    <div className="d-flex align-items-center gap-2 flex-wrap small ms-auto">
      <Link to="/library" className="text-decoration-underline">Library</Link>
      <span>&gt;</span>
      <Link to={`/library/period/${period.toLowerCase()}`} className="text-decoration-underline">
        {getPeriodLabel(intl, period)}
      </Link>
      <Dropdown align="end">
        <Dropdown.Toggle
          variant="link"
          size="sm"
          className="p-0 text-decoration-none"
          style={{ color: '#000' }}
          id={`library-period-switcher-${variant}`}
        />
        <Dropdown.Menu>
          {PERIODS.map(entry => (
            <Dropdown.Item
              as={Link}
              key={entry}
              to={`/library/period/${entry.toLowerCase()}`}
              active={entry === period}
            >
              {getPeriodLabel(intl, entry)}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>
    </div>
  );
}
