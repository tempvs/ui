import { getSession } from "./session";

export type Viewer = {
  userId: string;
  roles: string[];
};

/** The only browser-facing source of authenticated viewer state. */
export async function getViewer(options?: {
  refreshRoles?: boolean;
}): Promise<Viewer | null> {
  const session = await getSession(options);
  return session ? { userId: session.userId, roles: session.roles } : null;
}
