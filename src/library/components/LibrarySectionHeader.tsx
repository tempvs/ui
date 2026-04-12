import React from 'react';

import SectionHeaderBar from '../../component/SectionHeaderBar';
import LibraryPeriodBreadcrumb from './LibraryPeriodBreadcrumb';

type LibrarySectionHeaderProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  period?: string | null;
  variant?: string;
  middleContent?: React.ReactNode;
  rightContent?: React.ReactNode;
};

export default function LibrarySectionHeader({
  title,
  subtitle,
  period,
  variant = 'period',
  middleContent = null,
  rightContent = null,
}: LibrarySectionHeaderProps) {
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
