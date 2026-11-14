import { getFollowedClubs, getProfileClubs } from "../club/clubApi";
import { getFollowedEvents, getParticipatingEvents } from "../event/eventApi";
import { getFollowingProfiles } from "../profile/profileApi";
import { getGroupItems, getProfileStash } from "../profile/stashApi";
import type { WallTarget } from "./wallApi";

async function eventIds(
  profileId: string,
  read: typeof getFollowedEvents,
  signal?: AbortSignal,
): Promise<string[]> {
  const ids: string[] = [];
  const seen = new Set<string>();
  let token: string | undefined;
  do {
    if (signal?.aborted)
      throw new DOMException("Wall load cancelled", "AbortError");
    const page = await read(profileId, token);
    ids.push(...page.content.map((item) => String(item.id)));
    token = page.nextToken;
    if (token && seen.has(token))
      throw new Error("Event pages did not advance");
    if (token) seen.add(token);
  } while (token);
  return ids;
}

async function sourceIds(profileId: string, signal?: AbortSignal) {
  const stash = await getProfileStash(profileId);
  const groups = stash.groups || [];
  const ids = new Set<string>();
  let next = 0;
  let incomplete = false;
  // Finish every collection, but avoid one concurrent request chain per group.
  await Promise.all(
    Array.from({ length: Math.min(4, groups.length) }, async () => {
      while (next < groups.length && !signal?.aborted) {
        const group = groups[next++];
        try {
          const items = await getGroupItems(group.id);
          items.forEach(
            (item) => item.sources?.forEach((id) => ids.add(String(id))),
          );
        } catch {
          incomplete = true;
        }
      }
    }),
  );
  return { ids: Array.from(ids), incomplete };
}

export async function getWallTargets(profileId: string, signal?: AbortSignal) {
  // Source discovery starts as soon as Stash resolves, independently of slow
  // relationship reads. Never use the bounded collection snapshot endpoint:
  // it intentionally omits older items and would lose source updates.
  const results = await Promise.allSettled([
    getFollowingProfiles(profileId).then((items) =>
      items.map((item) => String(item.id)),
    ),
    getFollowedClubs(profileId).then((items) =>
      items.map((item) => String(item.id)),
    ),
    getProfileClubs(profileId).then((items) =>
      items.map((item) => String(item.id)),
    ),
    eventIds(profileId, getFollowedEvents, signal),
    eventIds(profileId, getParticipatingEvents, signal),
    sourceIds(profileId, signal),
  ]);
  const targets: WallTarget[] = [
    { type: "PROFILE", id: profileId, reason: "OWN_PROFILE" },
  ];
  const relationships: Array<[WallTarget["type"], WallTarget["reason"]]> = [
    ["PROFILE", "FOLLOWED_PROFILE"],
    ["CLUB", "FOLLOWED_CLUB"],
    ["CLUB", "CLUB_MEMBER"],
    ["EVENT", "FOLLOWED_EVENT"],
    ["EVENT", "EVENT_PARTICIPANT"],
    ["SOURCE", "SOURCE_USED"],
  ];
  let incomplete = false;
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      incomplete = true;
      return;
    }
    const value = result.value;
    const ids = Array.isArray(value) ? value : value.ids;
    if (!Array.isArray(value) && value.incomplete) incomplete = true;
    const [type, reason] = relationships[index];
    ids.forEach((id) => targets.push({ type, id, reason }));
  });
  const unique = Array.from(
    new Map(
      targets.map((target) => [
        `${target.type}:${target.id}:${target.reason}`,
        target,
      ]),
    ).values(),
  );
  return { targets: unique, incomplete, limited: unique.length > 60 };
}
