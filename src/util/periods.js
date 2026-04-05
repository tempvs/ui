import React from 'react';
import { Badge } from 'react-bootstrap';
import { useIntl } from 'react-intl';

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
];

export function getPeriodMessageId(period) {
  const periodKey = period?.toLowerCase?.();
  return periodKey ? `period.${periodKey}.heading` : null;
}

export function getPeriodLabel(intl, period) {
  const messageId = getPeriodMessageId(period);
  if (!messageId) {
    return '';
  }

  return intl.formatMessage({ id: messageId, defaultMessage: period });
}

export function PeriodBadge({ period }) {
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
