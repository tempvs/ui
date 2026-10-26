export const ROLE_ORDER = [
  "LIBRARY_ADMIN",
  "LIBRARY_ARCHIVARIUS",
  "LIBRARY_SCRIBE",
] as const;

export type LibraryRole = (typeof ROLE_ORDER)[number];

export type LibraryUserInfo =
  | {
      roles?: string[] | null;
    }
  | null
  | undefined;

export type RoleMeta = {
  label: string;
  description: string;
};

const ROLE_META: Record<LibraryRole, RoleMeta> = {
  LIBRARY_ADMIN: {
    label: "Library Admin",
    description: "Can manage role requests and all library sources.",
  },
  LIBRARY_ARCHIVARIUS: {
    label: "Archivarius",
    description:
      "Can assign Scribe access, and create and edit sources.",
  },
  LIBRARY_SCRIBE: {
    label: "Scribe",
    description: "Can create and edit source details and attached images.",
  },
};

export function getRoles(userInfo: LibraryUserInfo): Set<string> {
  const roles = new Set(userInfo?.roles || []);
  // TEMPVS_ADMIN is the account-wide administrator role. Cognito has no
  // nested-group support, so each domain maps that signed group to its own
  // highest local permission. Mirror the Library API's mapping here so the
  // UI never hides controls that the API will authorize.
  if (roles.has("TEMPVS_ADMIN")) roles.add("LIBRARY_ADMIN");
  return roles;
}

export function hasAnyRole(
  userInfo: LibraryUserInfo,
  rolesToCheck: LibraryRole[],
): boolean {
  const roles = getRoles(userInfo);
  return rolesToCheck.some((role) => roles.has(role));
}

export function canContribute(userInfo: LibraryUserInfo): boolean {
  return hasAnyRole(userInfo, [
    "LIBRARY_SCRIBE",
    "LIBRARY_ARCHIVARIUS",
    "LIBRARY_ADMIN",
  ]);
}

export function canEditSource(userInfo: LibraryUserInfo): boolean {
  return hasAnyRole(userInfo, [
    "LIBRARY_SCRIBE",
    "LIBRARY_ARCHIVARIUS",
    "LIBRARY_ADMIN",
  ]);
}

export function canDeleteSource(userInfo: LibraryUserInfo): boolean {
  return hasAnyRole(userInfo, ["LIBRARY_ADMIN"]);
}

export function canManageAllLibraryRoles(userInfo: LibraryUserInfo): boolean {
  return hasAnyRole(userInfo, ["LIBRARY_ADMIN"]);
}

export function canAccessLibraryAdministration(
  userInfo: LibraryUserInfo,
): boolean {
  return hasAnyRole(userInfo, ["LIBRARY_ARCHIVARIUS", "LIBRARY_ADMIN"]);
}

export function getPrimaryRole(userInfo: LibraryUserInfo): LibraryRole | null {
  const roles = getRoles(userInfo);
  return ROLE_ORDER.find((role) => roles.has(role)) || null;
}

export function getRoleMeta(role: string | null | undefined): RoleMeta | null {
  return role && role in ROLE_META ? ROLE_META[role as LibraryRole] : null;
}

export function getPrimaryRoleMeta(userInfo: LibraryUserInfo): RoleMeta | null {
  return getRoleMeta(getPrimaryRole(userInfo));
}
