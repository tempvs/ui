import React from 'react';
import { useIntl } from 'react-intl';

import SectionBreadcrumb from '../../component/SectionBreadcrumb';
import { getPeriodLabel, PERIODS } from '../libraryShared';

export default function LibraryPeriodBreadcrumb({ period, variant = 'period', trailingItem = null }) {
  const intl = useIntl();

  if (!period) {
    return null;
  }

  return (
    <SectionBreadcrumb
      className="ms-auto"
      items={[
        { label: 'Library', to: '/library' },
        {
          label: getPeriodLabel(intl, period),
          to: `/library/period/${period.toLowerCase()}`,
          switcher: {
            id: `library-period-switcher-${variant}`,
            items: PERIODS.map(entry => ({
              key: entry,
              label: getPeriodLabel(intl, entry),
              to: `/library/period/${entry.toLowerCase()}`,
              active: entry === period,
            })),
          },
        },
        trailingItem,
      ]}
    />
  );
}
