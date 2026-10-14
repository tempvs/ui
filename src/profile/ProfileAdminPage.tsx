import { useEffect, useState } from "react";
import { Alert, Button } from "react-bootstrap";
import { Link, useNavigate, useParams } from "react-router-dom";

import "../club/clubs.css";
import ConfirmationModal from "../component/ConfirmationModal";
import PageLayout from "../component/PageLayout";
import SectionBreadcrumb from "../component/SectionBreadcrumb";
import Spinner from "../component/Spinner";
import { deleteProfile, fetchCurrentUserInfo, fetchProfileById } from "./profileApi";
import type { Profile } from "./profileTypes";

/** Administrative controls intentionally exist only for owned club profiles.
 * Personal profile deletion remains unavailable until its account and
 * resource-retention policy has been designed. */
export default function ProfileAdminPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [viewerId, setViewerId] = useState<string | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    fetchCurrentUserInfo((info) => {
      if (active) setViewerId(info.currentUserId);
    });
    fetchProfileById(id, {
      onSuccess: (value) => {
        if (!active) return;
        setProfile(value);
        setLoading(false);
      },
      onMissing: () => {
        if (!active) return;
        setError("Profile not found.");
        setLoading(false);
      },
      onError: () => {
        if (!active) return;
        setError("Unable to load this profile.");
        setLoading(false);
      },
    });
    return () => {
      active = false;
    };
  }, [id]);

  const profilePath = profile
    ? `/profile/${profile.alias || profile.id}`
    : `/profile/${id}`;
  const canManage = Boolean(
    profile?.type === "CLUB" &&
      viewerId &&
      String(profile.userId) === String(viewerId),
  );
  const label = profile
    ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || "Club profile"
    : "Profile";

  const remove = async () => {
    if (!profile) return;
    setDeleting(true);
    setError("");
    try {
      const response = await deleteProfile(profile.id);
      if (!response.ok) throw new Error("Unable to delete this profile.");
      navigate(`/profile/user/${profile.userId}`, { replace: true });
    } catch (caught) {
      setError((caught as Error).message || "Unable to delete this profile.");
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  return (
    <PageLayout
      header={{
        title: (
          <SectionBreadcrumb
            items={[
              { label, to: profilePath },
              { label: "Administration" },
            ]}
          />
        ),
        rightContent: (
          <Link className="btn btn-outline-dark" to={profilePath}>
            View profile
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
          Profile administration is available only to the owner of a club profile.
        </Alert>
      ) : (
        <section className="club-panel mt-3">
          <h1 className="h4">Profile administration</h1>
          <p className="text-muted">
            Profile details, its picture, albums, posts, location, and years remain
            editable on the profile page.
          </p>
          {error && <Alert variant="danger">{error}</Alert>}
          <div className="border-top pt-3 mt-4">
            <h2 className="h6">Danger zone</h2>
            <p className="text-muted small">
              Deleting this club profile does not delete your user account or other profiles.
            </p>
            <Button
              variant="outline-danger"
              disabled={deleting}
              onClick={() => setConfirmingDelete(true)}
            >
              Delete profile
            </Button>
          </div>
        </section>
      )}
      <ConfirmationModal
        show={confirmingDelete}
        title="Delete club profile"
        message="Are you sure you want to delete this club profile? This cannot be undone."
        confirmLabel="Delete profile"
        busy={deleting}
        onHide={() => {
          if (!deleting) setConfirmingDelete(false);
        }}
        onConfirm={() => void remove()}
      />
    </PageLayout>
  );
}
