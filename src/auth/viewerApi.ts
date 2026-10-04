export type Viewer = {
  userId: string;
  roles: string[];
};

/** The only browser-facing source of authenticated viewer state. */
export async function getViewer(options?: { refreshRoles?: boolean }): Promise<Viewer | null> {
  const response = await fetch(
    options?.refreshRoles ? "/api/user/me?refresh=roles" : "/api/user/me",
  );
  if (!response.ok) return null;
  const data: unknown = await response.json();
  if (!data || typeof data !== "object") return null;
  const value = data as Record<string, unknown>;
  if (typeof value.userId !== "string" || !value.userId) return null;
  return {
    userId: value.userId,
    roles: Array.isArray(value.roles)
      ? value.roles.filter((role): role is string => typeof role === "string")
      : [],
  };
}
