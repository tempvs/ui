import React from 'react';

import PageHeader from '../../component/PageHeader';
import SectionBreadcrumb from '../../component/SectionBreadcrumb';
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
  title: _title,
  subtitle,
  period,
  variant = 'period',
  middleContent = null,
  rightContent = null,
}: LibrarySectionHeaderProps) {
  const breadcrumb = rightContent || (period
    ? <LibraryPeriodBreadcrumb period={period} variant={variant} />
    : <SectionBreadcrumb items={[{ label: 'Library', to: '/library' }]} />);

  return (
    <PageHeader
      title={breadcrumb}
      subtitle={subtitle}
      rightContent={middleContent}
      backgroundColor="#f3efe4"
      borderColor="#d9ccb0"
    />
  );
}
