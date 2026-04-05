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

export function parseUserInfo(headerValue) {
  if (!headerValue) {
    return null;
  }

  try {
    return JSON.parse(headerValue);
  } catch (error) {
    return null;
  }
}

export async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const userInfo = parseUserInfo(response.headers.get('User-Info'));
  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      data = text;
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
    userInfo,
  };
}

export function buildSearchQuery(query, period, classifications, types) {
  return window.btoa(encodeURIComponent(JSON.stringify({
    query,
    period,
    classifications,
    types,
  })));
}

export function getRoles(userInfo) {
  return new Set(userInfo?.roles || []);
}

export function canContribute(userInfo) {
  const roles = getRoles(userInfo);
  return roles.has('ROLE_CONTRIBUTOR') || roles.has('ROLE_SCRIBE') || roles.has('ROLE_ARCHIVARIUS') || roles.has('ROLE_ADMIN');
}

export function canEditSource(userInfo) {
  const roles = getRoles(userInfo);
  return roles.has('ROLE_SCRIBE') || roles.has('ROLE_ARCHIVARIUS') || roles.has('ROLE_ADMIN');
}

export function canDeleteSource(userInfo) {
  const roles = getRoles(userInfo);
  return roles.has('ROLE_ARCHIVARIUS') || roles.has('ROLE_ADMIN');
}

export function getPeriodLabel(intl, period) {
  const periodKey = period?.toLowerCase?.();
  if (!periodKey) {
    return '';
  }

  return intl.formatMessage({ id: `period.${periodKey}.heading`, defaultMessage: period });
}

export function getRoleLabel(role) {
  switch (role) {
    case 'ROLE_ADMIN':
      return 'Admin';
    case 'ROLE_ARCHIVARIUS':
      return 'Archivarius';
    case 'ROLE_SCRIBE':
      return 'Scribe';
    case 'ROLE_CONTRIBUTOR':
      return 'Contributor';
    default:
      return null;
  }
}

export function getRoleDescription(role) {
  switch (role) {
    case 'ROLE_ADMIN':
      return 'Can manage role requests and all library sources.';
    case 'ROLE_ARCHIVARIUS':
      return 'Can moderate sources, images, and review library requests.';
    case 'ROLE_SCRIBE':
      return 'Can edit source details and curate attached images.';
    case 'ROLE_CONTRIBUTOR':
      return 'Can add new sources and upload supporting images.';
    default:
      return null;
  }
}

export function getPrimaryRole(userInfo) {
  const roles = getRoles(userInfo);
  if (roles.has('ROLE_ADMIN')) {
    return 'ROLE_ADMIN';
  }
  if (roles.has('ROLE_ARCHIVARIUS')) {
    return 'ROLE_ARCHIVARIUS';
  }
  if (roles.has('ROLE_SCRIBE')) {
    return 'ROLE_SCRIBE';
  }
  if (roles.has('ROLE_CONTRIBUTOR')) {
    return 'ROLE_CONTRIBUTOR';
  }
  return null;
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
