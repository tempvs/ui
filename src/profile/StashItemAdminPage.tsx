import { useEffect, useState } from "react";
import { Alert, Button } from "react-bootstrap";
import { Link, useNavigate, useParams } from "react-router-dom";

import ConfirmationModal from "../component/ConfirmationModal";
import PageLayout from "../component/PageLayout";
import SectionBreadcrumb from "../component/SectionBreadcrumb";
import Spinner from "../component/Spinner";
import { fetchCurrentUserInfo, fetchProfileById } from "./profileApi";
import { deleteStashItem, getStashItem } from "./stashApi";
import type { Profile, StashItem } from "./profileTypes";

/** Owner-only irreversible controls are deliberately kept off the item page. */
export default function StashItemAdminPage() {
  const { id = "", itemId = "" } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [item, setItem] = useState<StashItem | null>(null);
  const [viewerId, setViewerId] = useState<string | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    fetchCurrentUserInfo((info) => {
      if (active) setViewerId(info.currentUserId || null);
    });
    Promise.all([
      getStashItem(itemId),
      new Promise<Profile | null>((resolve) => {
        fetchProfileById(id, {
          onSuccess: (value) => resolve(value || null),
          onMissing: () => resolve(null),
          onError: () => resolve(null),
        });
      }),
    ])
      .then(([nextItem, nextProfile]) => {
        if (!active) return;
        setItem(nextItem || null);
        setProfile(nextProfile);
        if (!nextItem || !nextProfile) setError("Item not found.");
      })
      .catch(() => {
        if (active) setError("Unable to load this item.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, itemId]);

  const stashPath = `/stash/${profile?.alias || profile?.id || id}`;
  const itemPath = `${stashPath}/items/${item?.id || itemId}`;
  const canManage = Boolean(
    profile?.type === "CLUB" &&
      viewerId &&
      String(profile.userId) === String(viewerId),
  );

  async function removeItem() {
    if (!item || !profile) return;
    setDeleting(true);
    setError("");
    try {
      await deleteStashItem(item.id);
      const groupQuery = item.itemGroup?.id ? `?group=${item.itemGroup.id}` : "";
      navigate(`${stashPath}${groupQuery}`, { replace: true });
    } catch (caught) {
      setError((caught as Error).message || "Unable to delete this item.");
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <PageLayout
      header={{
        title: (
          <SectionBreadcrumb
            items={[
              { label: "Stash", to: stashPath },
              { label: item?.itemGroup?.name || "Collection", to: stashPath },
              { label: item?.name || "Item", to: itemPath },
              { label: "Manage item" },
            ]}
          />
        ),
        rightContent: (
          <Link className="btn btn-outline-dark" to={itemPath}>
            View item
          </Link>
        ),
        backgroundColor: "#f8f4ea",
        borderColor: "#d8c7a1",
      }}
    >
      {loading || viewerId === undefined ? (
        <Spinner />
      ) : error && (!profile || !item) ? (
        <Alert variant="danger" className="mt-3">{error}</Alert>
      ) : !canManage ? (
        <Alert variant="danger" className="mt-3">
          Item administration is available only to the owner of this club profile.
        </Alert>
      ) : (
        <section className="club-panel mt-3">
          <h1 className="h4">Item management</h1>
          <p className="text-muted">
            Edit item details, pictures, source links, and collection placement on the item page.
          </p>
          {error && <Alert variant="danger">{error}</Alert>}
          <div className="border-top pt-3 mt-4">
            <h2 className="h6">Danger zone</h2>
            <p className="text-muted small">
              Deleting an item also removes its source links and collection-image arrows.
            </p>
            <Button
              variant="outline-danger"
              disabled={deleting}
              onClick={() => setConfirmingDelete(true)}
            >
              Delete item
            </Button>
          </div>
        </section>
      )}
      <ConfirmationModal
        show={confirmingDelete}
        title="Delete item"
        message="Are you sure you want to delete this item? This cannot be undone."
        confirmLabel="Delete item"
        busy={deleting}
        onHide={() => {
          if (!deleting) setConfirmingDelete(false);
        }}
        onConfirm={() => void removeItem()}
      />
    </PageLayout>
  );
}
