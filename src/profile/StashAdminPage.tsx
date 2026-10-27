import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-bootstrap";
import { FaTrashAlt } from "react-icons/fa";
import { Link, useParams } from "react-router-dom";

import "../club/clubs.css";
import ConfirmationModal from "../component/ConfirmationModal";
import IconActionButton from "../component/IconActionButton";
import PageLayout from "../component/PageLayout";
import SectionBreadcrumb from "../component/SectionBreadcrumb";
import Spinner from "../component/Spinner";
import { deleteStashGroup, getGroupItems, getProfileStash } from "./stashApi";
import { fetchCurrentUserInfo, fetchProfileById } from "./profileApi";
import type { Id, Profile, StashGroup } from "./profileTypes";

const TrashIcon = FaTrashAlt as React.ComponentType<{ className?: string }>;

function StashAdminPage() {
  const { id = "" } = useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [viewerId, setViewerId] = useState<Id | null | undefined>(undefined);
  const [groups, setGroups] = useState<StashGroup[]>([]);
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<StashGroup | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    fetchCurrentUserInfo((info) => {
      if (active) setViewerId(info.currentUserId || null);
    });
    fetchProfileById(id, {
      onSuccess: (value) => {
        if (!active) return;
        setProfile(value || null);
      },
      onMissing: () => {
        if (!active) return;
        setError("Club profile not found.");
        setProfile(null);
        setLoading(false);
      },
      onError: () => {
        if (!active) return;
        setError("Unable to load this club profile.");
        setProfile(null);
        setLoading(false);
      },
    });
    return () => {
      active = false;
    };
  }, [id]);

  const loadStash = useCallback(async () => {
    if (!profile) return;

    setLoading(true);
    setError("");
    try {
      const stash = await getProfileStash(profile.id);
      const nextGroups = stash.groups || [];
      const counts = await Promise.all(
        nextGroups.map(async (group) => [String(group.id), (await getGroupItems(group.id)).length] as const),
      );
      setGroups(nextGroups);
      setItemCounts(Object.fromEntries(counts));
    } catch {
      setError("Unable to load this club stash.");
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    if (profile) void loadStash();
  }, [loadStash, profile]);

  const canManage = Boolean(
    profile?.type === "CLUB" &&
      viewerId &&
      String(profile.userId) === String(viewerId),
  );
  const profilePath = profile ? `/profile/${profile.alias || profile.id}` : `/profile/${id}`;
  const stashPath = profile ? `/stash/${profile.alias || profile.id}` : `/stash/${id}`;
  const label = profile
    ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || "Club profile"
    : "Owned items";

  const removeGroup = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError("");
    try {
      await deleteStashGroup(deleteTarget.id);
      setDeleteTarget(null);
      await loadStash();
    } catch {
      setError("Unable to delete this collection.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <PageLayout
      header={{
        title: (
          <SectionBreadcrumb
            items={[
              { label, to: profilePath },
              { label: "Owned items", to: stashPath },
              { label: "Manage stash" },
            ]}
          />
        ),
        rightContent: (
          <Link className="btn btn-outline-dark" to={stashPath}>
            View owned items
          </Link>
        ),
        backgroundColor: "#f8f4ea",
        borderColor: "#d8c7a1",
      }}
    >
      {loading || viewerId === undefined ? (
        <Spinner />
      ) : error && !profile ? (
        <Alert variant="danger" className="mt-3">{error}</Alert>
      ) : !canManage ? (
        <Alert variant="danger" className="mt-3">
          Stash management is available only to the owner of a club profile.
        </Alert>
      ) : (
        <section className="club-panel mt-3">
          <h1 className="h4">Stash management</h1>
          <p className="text-muted">
            Manage collections for this profile. Deleting a collection also removes
            its items, images, and source assignments; linked sources remain intact.
          </p>
          {error && <Alert variant="danger">{error}</Alert>}
          {groups.length ? (
            <div className="stash-management-list">
              {groups.map((group) => (
                <div className="stash-management-row" key={group.id}>
                  <div>
                    <div className="fw-semibold">{group.name || "Collection"}</div>
                    <div className="small text-muted">
                      {itemCounts[String(group.id)] || 0} item(s)
                    </div>
                  </div>
                  <IconActionButton
                    title="Delete collection"
                    onClick={() => setDeleteTarget(group)}
                    borderColor="#c77d7d"
                    color="#8e2323"
                    backgroundColor="#fff"
                  >
                    <TrashIcon />
                  </IconActionButton>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted mb-0">No collections yet.</p>
          )}
        </section>
      )}
      <ConfirmationModal
        show={Boolean(deleteTarget)}
        title="Delete collection"
        message="Delete this collection and all of its items, images, and source assignments? Sources themselves will not be deleted."
        confirmLabel="Delete collection"
        busy={deleting}
        onHide={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        onConfirm={() => void removeGroup()}
      />
    </PageLayout>
  );
}

export default StashAdminPage;
