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

export const CLASSIFICATIONS = ['CLOTHING', 'FOOTWEAR', 'HOUSEHOLD', 'WEAPON', 'ARMOR', 'OTHER'];
export const TYPES = ['WRITTEN', 'GRAPHIC', 'ARCHAEOLOGICAL', 'OTHER'];
export const PAGE_SIZE = 40;

export function getPeriodLabel(intl, period) {
  const periodKey = period?.toLowerCase?.();
  if (!periodKey) {
    return '';
  }

  return intl.formatMessage({ id: `period.${periodKey}.heading`, defaultMessage: period });
}

export function PeriodBadge({ period }) {
  const intl = useIntl();
  const periodKey = period?.toLowerCase?.();

  if (!periodKey) {
    return null;
  }

  return (
    <Badge bg="light" text="dark" className="border">
      {intl.formatMessage({ id: `period.${periodKey}.heading`, defaultMessage: period })}
    </Badge>
  );
}
