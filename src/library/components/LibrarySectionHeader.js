import React from 'react';

import SectionHeaderBar from '../../component/SectionHeaderBar';
import LibraryPeriodBreadcrumb from './LibraryPeriodBreadcrumb';

export default function LibrarySectionHeader({ title, subtitle, period, variant = 'period', middleContent = null, rightContent = null }) {
  const resolvedRightContent = rightContent || <LibraryPeriodBreadcrumb period={period} variant={variant} />;

  return (
    <SectionHeaderBar
      title={title}
      subtitle={subtitle}
      middleContent={middleContent}
      rightContent={resolvedRightContent}
      backgroundColor="#f3efe4"
      borderColor="#d9ccb0"
    />
  );
}
