import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import ThumbnailList, { ThumbnailEntry } from "../../component/ThumbnailList";
import DismissibleCoachmark from "../../component/DismissibleCoachmark";
import { Id, MessageFormatter, StashItem } from "../profileTypes";
import { getGroupItemsPage, getProfileStash } from "../stashApi";
import ProfileRelationshipPanel from "./ProfileRelationshipPanel";

type Props = {
  profileId: Id;
  alias?: string | null;
  editable: boolean;
  t: MessageFormatter;
};

type OwnedItem = { item: StashItem; collectionName: string };

/** A filtered overview across collections; the heading opens the full stash. */
export default function ProfileItemsPanel({ profileId, alias, editable, t }: Props) {
  const [items, setItems] = useState<OwnedItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const loadMore = useRef<() => void>(() => {});
  const stashPath = `/stash/${alias || profileId}`;
  const title = t("profile.items.title", "Items");

  useEffect(() => {
    let active = true;
    let fetching = false;
    let groups: Awaited<ReturnType<typeof getProfileStash>>['groups'];
    let groupIndex = 0;
    let nextToken: string | undefined;
    const seen = new Set<string>();
    setLoaded(false);
    setFailed(false);
    setItems([]);
    setFilter("");
    setHasMore(false);
    const load = async () => {
      if (!active || fetching) return;
      fetching = true;
      setLoading(true);
      setFailed(false);
      try {
        if (!groups) groups = (await getProfileStash(profileId)).groups || [];
        const ownedItems: OwnedItem[] = [];
        // Skip empty pages/collections without declaring an empty stash early.
        while (active && groupIndex < groups.length && ownedItems.length === 0) {
          const group = groups[groupIndex];
          const result = await getGroupItemsPage(group.id, nextToken);
          if (!active) return;
          for (const item of result.content) {
            if (seen.has(String(item.id))) continue;
            seen.add(String(item.id));
            ownedItems.push({ item, collectionName: group.name || "" });
          }
          nextToken = result.nextToken;
          if (!nextToken) groupIndex += 1;
        }
        if (active) {
          setItems(current => [...current, ...ownedItems]);
          setHasMore(groupIndex < groups.length);
        }
      } catch {
        if (active) setFailed(true);
      } finally {
        fetching = false;
        if (active) { setLoaded(true); setLoading(false); }
      }
    };
    loadMore.current = () => { void load(); };
    void load();
    return () => { active = false; };
  }, [profileId]);

  return <ProfileRelationshipPanel
    title={title}
    titleContent={<DismissibleCoachmark
      id={`open-owned-items:${profileId}`}
      visible={editable && loaded && !loading && !hasMore && !failed && items.length === 0}
      message={t("profile.items.firstItemHint", "Open Items to add your first item.")}
    >
      <Link to={stashPath} className="profile-items-title">{title}</Link>
    </DismissibleCoachmark>}
    className="profile-items-panel mb-3"
    items={items}
    loaded={loaded}
    filter={filter}
    onFilterChange={setFilter}
    loadingMore={loading && loaded}
    onReachEnd={hasMore && !loading ? () => loadMore.current() : undefined}
    filterPlaceholder={t("profile.items.filter", "Filter items")}
    getSearchText={({ item, collectionName }) => `${item.name || ""} ${item.description || ""} ${collectionName}`}
    emptyText={t("profile.items.empty", "No items yet.")}
    noMatchesText={t("profile.items.noMatches", "No items match this filter.")}
    error={failed ? t("profile.items.loadFailed", "Unable to load items right now.") : ""}
    onRetry={() => loadMore.current()}
    renderItems={visibleItems => <ThumbnailList items={visibleItems} getKey={({ item }) => item.id}
        renderItem={({ item, collectionName }) => <ThumbnailEntry
          to={`${stashPath}/items/${item.id}`}
          label={item.name || t("profile.items.unnamed", "Unnamed item")}
          meta={collectionName}
          image={{ resourceType: "item", resourceId: item.id }}
        />} />}
  />;
}
