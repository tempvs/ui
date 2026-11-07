import React, { useEffect, useState } from "react";
import { Button } from "react-bootstrap";
import { Link } from "react-router-dom";

import { DEFAULT_HOURGLASS_IMAGE_SRC } from "../../component/DefaultHourglassImage";
import DismissibleCoachmark from "../../component/DismissibleCoachmark";
import RefreshingImage from "../../image/RefreshingImage";
import { Id, MessageFormatter, StashItem } from "../profileTypes";
import { getGroupItems, getProfileStash } from "../stashApi";
import ProfileRelationshipPanel from "./ProfileRelationshipPanel";

type Props = {
  profileId: Id;
  alias?: string | null;
  editable: boolean;
  t: MessageFormatter;
};

type OwnedItem = { item: StashItem; collectionName: string };
const PAGE_SIZE = 10;

/** A filtered overview across collections; the heading opens the full stash. */
export default function ProfileItemsPanel({ profileId, alias, editable, t }: Props) {
  const [items, setItems] = useState<OwnedItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);
  const stashPath = `/stash/${alias || profileId}`;
  const title = t("profile.items.title", "Items");

  useEffect(() => {
    let active = true;
    setLoaded(false);
    setFailed(false);
    setItems([]);
    setFilter("");
    setPage(0);
    const load = async () => {
      const stash = await getProfileStash(profileId);
      const ownedItems: OwnedItem[] = [];
      const seen = new Set<string>();
      // Read collections in sequence to avoid a burst of optional profile reads.
      // The API helpers follow cursors, so filtering includes every collection.
      for (const group of stash.groups || []) {
        if (!active) return;
        const groupItems = await getGroupItems(group.id);
        for (const item of groupItems) {
          if (seen.has(String(item.id))) continue;
          seen.add(String(item.id));
          ownedItems.push({ item, collectionName: group.name || "" });
        }
      }
      if (active) setItems(ownedItems);
    };
    void load()
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [profileId, revision]);

  return <ProfileRelationshipPanel
    title={title}
    titleContent={<DismissibleCoachmark
      id={`open-owned-items:${profileId}`}
      visible={editable && loaded && !failed && items.length === 0}
      message={t("profile.items.firstItemHint", "Open Items to add your first item.")}
    >
      <Link to={stashPath} className="profile-items-title">{title}</Link>
    </DismissibleCoachmark>}
    className="profile-items-panel mb-3"
    items={items}
    loaded={loaded}
    filter={filter}
    onFilterChange={value => { setFilter(value); setPage(0); }}
    filterPlaceholder={t("profile.items.filter", "Filter items")}
    getSearchText={({ item, collectionName }) => `${item.name || ""} ${item.description || ""} ${collectionName}`}
    emptyText={t("profile.items.empty", "No items yet.")}
    noMatchesText={t("profile.items.noMatches", "No items match this filter.")}
    error={failed ? t("profile.items.loadFailed", "Unable to load items right now.") : ""}
    onRetry={() => setRevision(value => value + 1)}
    renderItems={visibleItems => {
      const pageCount = Math.ceil(visibleItems.length / PAGE_SIZE);
      const currentPage = Math.min(page, pageCount - 1);
      const pageItems = visibleItems.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
      return <>
        <ul className="club-member-list profile-club-list mb-0">
          {pageItems.map(({ item, collectionName }) => <li key={item.id}>
            <Link className="club-thumbnail-link" to={`${stashPath}/items/${item.id}`}>
              <RefreshingImage
                image={{ resourceType: "item", resourceId: item.id }}
                variant="thumbnail"
                fallbackSrc={DEFAULT_HOURGLASS_IMAGE_SRC}
                className="club-list-thumbnail"
                alt=""
                loading="lazy"
              />
              <span className="profile-items-label">
                <span>{item.name || t("profile.items.unnamed", "Unnamed item")}</span>
                {collectionName && <small className="text-muted">{collectionName}</small>}
              </span>
            </Link>
          </li>)}
        </ul>
        {pageCount > 1 && <nav className="profile-items-pagination" aria-label={t("profile.items.pagination", "Items pagination")}>
          <Button size="sm" variant="outline-secondary" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>
            {t("profile.items.previous", "Previous")}
          </Button>
          <span aria-live="polite">{t("profile.items.page", "{page} of {total}", { page: currentPage + 1, total: pageCount })}</span>
          <Button size="sm" variant="outline-secondary" disabled={currentPage === pageCount - 1} onClick={() => setPage(currentPage + 1)}>
            {t("profile.items.next", "Next")}
          </Button>
        </nav>}
      </>;
    }}
  />;
}
