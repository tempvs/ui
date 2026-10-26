import { useEffect, useState } from "react";
import { Button, Card } from "react-bootstrap";
import { useNavigate, useParams } from "react-router-dom";

import AdministrationTabs from "../../component/AdministrationTabs";
import RoleMemberPanel from "../../component/RoleMemberPanel";
import SectionBreadcrumb from "../../component/SectionBreadcrumb";
import Spinner from "../../component/Spinner";
import {
  getUserProfileByUserId,
  getUserProfilesByUserIds,
  searchProfiles,
} from "../../profile/profileApi";
import ProfileThumbnailLink from "../../profile/components/ProfileThumbnailLink";
import { Profile } from "../../profile/profileTypes";
import { getErrorMessage } from "../../util/errors";
import {
  getAdminMembers,
  getAdminRoleRequests,
  LibraryMember,
  LibraryRoleRequest,
  LibraryViewer,
  getLibraryViewer,
  setAdminMemberRole,
  updateAdminRoleRequest,
} from "../libraryApi";
import LibrarySectionHeader from "../components/LibrarySectionHeader";
import { PAGE_SIZE } from "../libraryShared";
import { LibraryPendingProposalsContent } from "./LibraryPendingProposalsPage";

type AdminTab = "members" | "requests" | "proposals";
const ROLE_OPTIONS: Array<{ value: LibraryMember["role"]; label: string }> = [
  { value: "LIBRARY_ADMIN", label: "Library administrator" },
  { value: "LIBRARY_ARCHIVARIUS", label: "Archivarius" },
  { value: "LIBRARY_SCRIBE", label: "Scribe" },
];
export default function LibraryAdminPage() {
  const { tab: tabParam } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const tab: AdminTab =
    tabParam === "requests" || tabParam === "proposals" ? tabParam : "members";
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<LibraryMember[]>([]);
  const [userInfo, setUserInfo] = useState<LibraryViewer>(null);
  const [roleRequests, setRoleRequests] = useState<LibraryRoleRequest[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [memberProfiles, setMemberProfiles] = useState<Record<string, Profile>>(
    {},
  );
  const [roleRequestProfiles, setRoleRequestProfiles] = useState<
    Record<string, Profile>
  >({});
  const hydrateMemberProfiles = async (nextMembers: LibraryMember[]) => {
    const profiles = await Promise.all(
      nextMembers.map(async (member) => {
        try {
          const profile = await getUserProfileByUserId(member.userId);
          return profile ? [member.userId, profile] : null;
        } catch {
          return null;
        }
      }),
    );
    const resolvedProfiles = profiles.filter(
      (value): value is [string, Profile] => value !== null,
    );
    setMemberProfiles(Object.fromEntries(resolvedProfiles));
  };

  const hydrateRoleRequestProfiles = async (
    requests: LibraryRoleRequest[],
  ) => {
    try {
      const profiles = await getUserProfilesByUserIds(
        requests.map((request) => request.userId),
      );
      setRoleRequestProfiles((current) => ({
        ...current,
        ...Object.fromEntries(
          profiles
            .filter((profile) => Boolean(profile.userId))
            .map((profile) => [String(profile.userId), profile]),
        ),
      }));
    } catch {
      // A missing Profile read must not make the moderation queue unavailable.
      // The request's stored display name remains visible as a fallback.
    }
  };

  const isLibraryAdmin = Boolean(userInfo?.roles?.includes("LIBRARY_ADMIN"));
  const isTempvsAdmin = Boolean(userInfo?.roles?.includes("TEMPVS_ADMIN"));
  const assignableRoleOptions = ROLE_OPTIONS.filter((option) =>
    option.value === "LIBRARY_ADMIN"
      ? isTempvsAdmin
      : isLibraryAdmin || option.value !== "LIBRARY_ARCHIVARIUS",
  );

  const loadMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      // Refresh Cognito group claims before calling the protected endpoint.
      // A role can be granted while this browser session is alive.
      const viewer = await getLibraryViewer({ refreshRoles: true });
      const result = await getAdminMembers();
      if (!result.ok)
        throw new Error(
          result.status === 403
            ? "Admin access is required."
            : "Unable to load Library members.",
        );
      const nextMembers = result.data?.members || [];
      setMembers(nextMembers);
      setUserInfo(viewer);
      void hydrateMemberProfiles(nextMembers);
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setLoading(false);
    }
  };
  const loadRoleRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAdminRoleRequests({ size: PAGE_SIZE });
      if (!result.ok)
        throw new Error(
          result.status === 403
            ? "Admin access is required."
            : "Unable to load role requests.",
        );
      const requests = result.data?.roleRequests || [];
      setRoleRequests(requests);
      setNextToken(result.data?.nextToken || null);
      // Resolve the requesters in one Profile API call so the moderation list
      // uses the same linked avatar/name treatment as every other profile
      // list. A historical request can outlive a deleted profile, so retain
      // the Library-provided name as a safe fallback below.
      void hydrateRoleRequestProfiles(requests);
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    setNotice(null);
    if (tab === "members") {
      void loadMembers();
      return;
    }
    if (tab === "requests") {
      void loadRoleRequests();
      return;
    }
    setLoading(false);
    setError(null);
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps -- loading functions intentionally refresh on a URL tab change.
  const updateMember = async (member: LibraryMember, role: string | null) => {
    setError(null);
    setNotice(null);
    setUpdating(member.userId);
    try {
      const result = await setAdminMemberRole(member.userId, role);
      if (!result.ok) throw new Error("Unable to update the Library role.");
      const nextMembers = result.data?.members || [];
      setMembers(nextMembers);
      void hydrateMemberProfiles(nextMembers);
      setNotice(
        "Library role updated. The member must refresh their session before new permissions appear.",
      );
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setUpdating(null);
    }
  };
  const assignProfile = async (profile: Profile, role: string) => {
    if (!profile.userId) return;
    setError(null);
    setNotice(null);
    setUpdating(profile.userId);
    try {
      const result = await setAdminMemberRole(profile.userId, role);
      if (!result.ok) throw new Error("Unable to assign the Library role.");
      const nextMembers = result.data?.members || [];
      setMembers(nextMembers);
      void hydrateMemberProfiles(nextMembers);
      setNotice(
        "Library role assigned. The member must refresh their session before new permissions appear.",
      );
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setUpdating(null);
    }
  };
  const updateRoleRequest = async (
    role: string,
    userId: string,
    method: string,
  ) => {
    setError(null);
    setNotice(null);
    setUpdating(`${userId}:${role}`);
    try {
      const result = await updateAdminRoleRequest(role, userId, method);
      if (!result.ok) throw new Error("Unable to update the role request.");
      await loadRoleRequests();
      if (result.status === 202)
        setNotice(
          "Approval is queued. The user role will be granted asynchronously.",
        );
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setUpdating(null);
    }
  };
  const loadMoreRoleRequests = async () => {
    if (!nextToken || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await getAdminRoleRequests({ size: PAGE_SIZE, nextToken });
      if (!result.ok) throw new Error("Unable to load more role requests.");
      setRoleRequests((current) => [
        ...current,
        ...(result.data?.roleRequests || []),
      ]);
      setNextToken(result.data?.nextToken || null);
      void hydrateRoleRequestProfiles(result.data?.roleRequests || []);
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setLoadingMore(false);
    }
  };
  return (
    <div className="page-layout-content px-4 px-xl-5 pb-4">
      <LibrarySectionHeader
        title="LIBRARY"
        subtitle="Manage members and review Library access requests."
        period={null}
        variant="admin"
        rightContent={
          <SectionBreadcrumb
            className="ms-auto"
            items={[
              { label: "Library", to: "/library" },
              { label: "Library administration", to: "/library/admin" },
            ]}
          />
        }
      />
      <AdministrationTabs
        ariaLabel="Library administration"
        activeTab={tab}
        onSelect={(next) => navigate(`/library/admin/${next}`)}
        tabs={[
          { id: "members", label: "Members" },
          { id: "requests", label: "Role requests" },
          { id: "proposals", label: "Pending proposals" },
        ]}
      />
      {error && <div className="tempvs-plain-message text-danger">{error}</div>}
      {notice && (
        <div className="tempvs-plain-message text-muted" role="status">
          {notice}
        </div>
      )}
      {loading && <Spinner />}
      {!loading && tab === "members" && (
        <RoleMemberPanel
          areaLabel="Library"
          members={members.map((member) => ({
            ...member,
            protectedRole: member.role === "LIBRARY_ADMIN",
          }))}
          profiles={memberProfiles}
          roleOptions={assignableRoleOptions}
          viewerUserId={userInfo?.userId}
          busyUserId={updating}
          searchProfiles={(query) =>
            searchProfiles({ query, type: "USER", size: 20 })
          }
          canChangeMember={(member) =>
            member.userId !== userInfo?.userId &&
            (!member.protectedRole || isTempvsAdmin)
          }
          onAdd={(profile, role) => void assignProfile(profile, role)}
          onChangeRole={(member, role) => {
            const currentMember = members.find(
              (candidate) => candidate.userId === member.userId,
            );
            if (currentMember) void updateMember(currentMember, role);
          }}
          onRemove={(member) => {
            const currentMember = members.find(
              (candidate) => candidate.userId === member.userId,
            );
            if (currentMember) void updateMember(currentMember, null);
          }}
        />
      )}
      {tab === "proposals" && <LibraryPendingProposalsContent />}
      {!loading && tab === "requests" && (
        <div className="d-flex flex-column gap-3">
          {roleRequests.length === 0 && (
            <div className="tempvs-plain-message text-muted mb-0">
              No pending role requests.
            </div>
          )}
          {roleRequests.map((request) => {
            const profile =
              roleRequestProfiles[request.userId] ||
              (request.profileId
                ? { id: request.profileId, name: request.userName }
                : null);
            return (
              <Card
                key={`${request.userId}-${request.role}`}
                className="border-0 shadow-sm"
              >
                <Card.Body className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
                  <div className="d-flex align-items-center gap-3">
                    {profile ? (
                      <ProfileThumbnailLink profile={profile} />
                    ) : (
                      <div className="fw-semibold">
                        {request.userName || "User"}
                      </div>
                    )}
                    <div className="text-muted small">{request.roleLabel}</div>
                  </div>
                  <div className="d-flex gap-2">
                  <Button
                    variant="outline-success"
                    disabled={updating !== null}
                    onClick={() =>
                      void updateRoleRequest(
                        request.role,
                        request.userId,
                        "POST",
                      )
                    }
                  >
                    Approve
                  </Button>
                  <Button
                    variant="outline-danger"
                    disabled={updating !== null}
                    onClick={() =>
                      void updateRoleRequest(
                        request.role,
                        request.userId,
                        "DELETE",
                      )
                    }
                  >
                    Reject
                  </Button>
                  </div>
                </Card.Body>
              </Card>
            );
          })}
          {nextToken && (
            <Button
              variant="outline-dark"
              disabled={loadingMore}
              onClick={() => void loadMoreRoleRequests()}
            >
              {loadingMore ? "Loading..." : "Load more requests"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
