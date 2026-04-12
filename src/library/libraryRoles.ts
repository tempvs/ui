export const ROLE_ORDER = ['ROLE_ADMIN', 'ROLE_ARCHIVARIUS', 'ROLE_SCRIBE', 'ROLE_CONTRIBUTOR'] as const;

export type LibraryRole = typeof ROLE_ORDER[number];

export type LibraryUserInfo = {
  roles?: string[] | null;
} | null | undefined;

export type RoleMeta = {
  label: string;
  description: string;
};

const ROLE_META: Record<LibraryRole, RoleMeta> = {
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

export function getRoles(userInfo: LibraryUserInfo): Set<string> {
  return new Set(userInfo?.roles || []);
}

export function hasAnyRole(userInfo: LibraryUserInfo, rolesToCheck: LibraryRole[]): boolean {
  const roles = getRoles(userInfo);
  return rolesToCheck.some(role => roles.has(role));
}

export function canContribute(userInfo: LibraryUserInfo): boolean {
  return hasAnyRole(userInfo, ['ROLE_CONTRIBUTOR', 'ROLE_SCRIBE', 'ROLE_ARCHIVARIUS', 'ROLE_ADMIN']);
}

export function canEditSource(userInfo: LibraryUserInfo): boolean {
  return hasAnyRole(userInfo, ['ROLE_SCRIBE', 'ROLE_ARCHIVARIUS', 'ROLE_ADMIN']);
}

export function canDeleteSource(userInfo: LibraryUserInfo): boolean {
  return hasAnyRole(userInfo, ['ROLE_ARCHIVARIUS', 'ROLE_ADMIN']);
}

export function getPrimaryRole(userInfo: LibraryUserInfo): LibraryRole | null {
  const roles = getRoles(userInfo);
  return ROLE_ORDER.find(role => roles.has(role)) || null;
}

export function getRoleMeta(role: string | null | undefined): RoleMeta | null {
  return role && role in ROLE_META ? ROLE_META[role as LibraryRole] : null;
}

export function getPrimaryRoleMeta(userInfo: LibraryUserInfo): RoleMeta | null {
  return getRoleMeta(getPrimaryRole(userInfo));
}
