import React from 'react';
import { Badge } from 'react-bootstrap';
import { IntlShape, useIntl } from 'react-intl';

export const PERIODS = [
  'ANCIENT',
  'ANTIQUITY',
  'EARLY_MIDDLE_AGES',
  'HIGH_MIDDLE_AGES',
  'LATE_MIDDLE_AGES',
  'RENAISSANCE',
  'MODERN',
  'WWI',
  'WWII',
  'CONTEMPORARY',
  'OTHER',
] as const;

export type Period = typeof PERIODS[number];

type PeriodValue = string | null | undefined;

type PeriodBadgeProps = {
  period?: PeriodValue;
};

export function getPeriodMessageId(period: PeriodValue): string | null {
  const periodKey = period?.toLowerCase?.();
  return periodKey ? `period.${periodKey}.heading` : null;
}

export function getPeriodLabel(intl: IntlShape, period: PeriodValue): string {
  const messageId = getPeriodMessageId(period);
  if (!messageId) {
    return '';
  }

  return intl.formatMessage({ id: messageId, defaultMessage: period || '' });
}

export function PeriodBadge({ period }: PeriodBadgeProps) {
  const intl = useIntl();
  const label = getPeriodLabel(intl, period);

  if (!label) {
    return null;
  }

  return (
    <Badge bg="light" text="dark" className="border">
      {label}
    </Badge>
  );
}
