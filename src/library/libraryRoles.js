const ROLE_ORDER = ['ROLE_ADMIN', 'ROLE_ARCHIVARIUS', 'ROLE_SCRIBE', 'ROLE_CONTRIBUTOR'];

const ROLE_META = {
  ROLE_ADMIN: {
    label: 'Admin',
    description: 'Can manage role requests and all library sources.',
  },
  ROLE_ARCHIVARIUS: {
    label: 'Archivarius',
    description: 'Can moderate sources, images, and review library requests.',
  },
  ROLE_SCRIBE: {
    label: 'Scribe',
    description: 'Can edit source details and curate attached images.',
  },
  ROLE_CONTRIBUTOR: {
    label: 'Contributor',
    description: 'Can add new sources and upload supporting images.',
  },
};

export function getRoles(userInfo) {
  return new Set(userInfo?.roles || []);
}

export function hasAnyRole(userInfo, rolesToCheck) {
  const roles = getRoles(userInfo);
  return rolesToCheck.some(role => roles.has(role));
}

export function canContribute(userInfo) {
  return hasAnyRole(userInfo, ['ROLE_CONTRIBUTOR', 'ROLE_SCRIBE', 'ROLE_ARCHIVARIUS', 'ROLE_ADMIN']);
}

export function canEditSource(userInfo) {
  return hasAnyRole(userInfo, ['ROLE_SCRIBE', 'ROLE_ARCHIVARIUS', 'ROLE_ADMIN']);
}

export function canDeleteSource(userInfo) {
  return hasAnyRole(userInfo, ['ROLE_ARCHIVARIUS', 'ROLE_ADMIN']);
}

export function getPrimaryRole(userInfo) {
  const roles = getRoles(userInfo);
  return ROLE_ORDER.find(role => roles.has(role)) || null;
}

export function getRoleMeta(role) {
  return role ? ROLE_META[role] || null : null;
}

export function getPrimaryRoleMeta(userInfo) {
  return getRoleMeta(getPrimaryRole(userInfo));
}
