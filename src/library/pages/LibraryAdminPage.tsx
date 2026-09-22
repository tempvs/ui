import React, { useEffect, useState } from "react";
import { Button, Card, Form, Modal } from "react-bootstrap";
import { FaPlus, FaTrash } from "react-icons/fa";
import { Link } from "react-router-dom";

import IconActionButton from "../../component/IconActionButton";
import SectionBreadcrumb from "../../component/SectionBreadcrumb";
import Spinner from "../../component/Spinner";
import { buildProfileLabel } from "../../profile/currentProfile";
import {
  getProfileAvatar,
  getUserProfileByUserId,
  searchProfiles,
} from "../../profile/profileApi";
import { Profile } from "../../profile/profileTypes";
import { getErrorMessage } from "../../util/errors";
import {
  getAdminMembers,
  getAdminRoleRequests,
  LibraryMember,
  LibraryRoleRequest,
  LibraryUserInfoPayload,
  setAdminMemberRole,
  updateAdminRoleRequest,
} from "../libraryApi";
import LibrarySectionHeader from "../components/LibrarySectionHeader";
import { PAGE_SIZE } from "../libraryShared";

type AdminTab = "members" | "requests";
const ROLE_OPTIONS = [
  { value: "ROLE_ARCHIVARIUS", label: "Archivarius" },
  { value: "ROLE_SCRIBE", label: "Scribe" },
  { value: "ROLE_CONTRIBUTOR", label: "Contributor" },
];
const TrashIcon = FaTrash as React.ComponentType<{ className?: string }>;
const PlusIcon = FaPlus as React.ComponentType<{ className?: string }>;

function ProfileThumbnail({
  profile,
  avatarUrl,
  label,
}: {
  profile?: Profile | null;
  avatarUrl?: string | null;
  label: string;
}) {
  const imageUrl = avatarUrl || profile?.avatarUrl;
  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return imageUrl ? (
    <img
      src={imageUrl}
      alt=""
      className="rounded-circle object-fit-cover flex-shrink-0"
      style={{ width: "2.5rem", height: "2.5rem" }}
    />
  ) : (
    <div
      aria-hidden="true"
      className="rounded-circle bg-light border d-inline-flex align-items-center justify-content-center flex-shrink-0 text-muted small"
      style={{ width: "2.5rem", height: "2.5rem" }}
    >
      {initials || "?"}
    </div>
  );
}

export default function LibraryAdminPage() {
  const [tab, setTab] = useState<AdminTab>("members");
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<LibraryMember[]>([]);
  const [memberUserIds, setMemberUserIds] = useState<string[]>([]);
  const [userInfo, setUserInfo] = useState<LibraryUserInfoPayload>(null);
  const [roleRequests, setRoleRequests] = useState<LibraryRoleRequest[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [memberFilter, setMemberFilter] = useState("");
  const [memberProfiles, setMemberProfiles] = useState<Record<string, Profile>>(
    {},
  );
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string | null>>(
    {},
  );
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberPendingRemoval, setMemberPendingRemoval] =
    useState<LibraryMember | null>(null);
  const [profileQuery, setProfileQuery] = useState("");
  const [profileResults, setProfileResults] = useState<Profile[]>([]);
  const [profileSearchLoading, setProfileSearchLoading] = useState(false);
  const [profileSearchComplete, setProfileSearchComplete] = useState(false);
  const [profileRoleSelection, setProfileRoleSelection] = useState<
    Record<string, string>
  >({});

  const hydrateAvatars = async (profiles: Profile[]) => {
    const entries = await Promise.all(
      profiles.map(async (profile) => {
        try {
          const avatar = await getProfileAvatar(profile.id);
          return [
            profile.id,
            avatar?.thumbnailUrl || avatar?.url || profile.avatarUrl || null,
          ] as const;
        } catch {
          return [profile.id, profile.avatarUrl || null] as const;
        }
      }),
    );
    setAvatarUrls((current) => ({
      ...current,
      ...Object.fromEntries(entries),
    }));
  };

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
    void hydrateAvatars(resolvedProfiles.map(([, profile]) => profile));
  };

  const isLibraryAdmin = Boolean(userInfo?.roles?.includes("ROLE_ADMIN"));
  const assignableRoleOptions = isLibraryAdmin
    ? ROLE_OPTIONS
    : ROLE_OPTIONS.filter((option) => option.value !== "ROLE_ARCHIVARIUS");

  const loadMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAdminMembers();
      if (!result.ok)
        throw new Error(
          result.status === 403
            ? "Admin access is required."
            : "Unable to load Library members.",
        );
      const nextMembers = result.data?.members || [];
      setMembers(nextMembers);
      setMemberUserIds(
        result.data?.memberUserIds || nextMembers.map((member) => member.userId),
      );
      setUserInfo(result.userInfo);
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
      setRoleRequests(result.data?.roleRequests || []);
      setNextToken(result.data?.nextToken || null);
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void loadMembers();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- initial load; tab changes refresh it.
  const switchTab = (next: AdminTab) => {
    setTab(next);
    setNotice(null);
    if (next === "members") void loadMembers();
    else void loadRoleRequests();
  };
  const updateMember = async (member: LibraryMember, role: string) => {
    setError(null);
    setNotice(null);
    setUpdating(member.userId);
    try {
      const result = await setAdminMemberRole(member.userId, role);
      if (!result.ok) throw new Error("Unable to update the Library role.");
      const nextMembers = result.data?.members || [];
      setMembers(nextMembers);
      setMemberUserIds(
        result.data?.memberUserIds || nextMembers.map((item) => item.userId),
      );
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
  useEffect(() => {
    const query = profileQuery.trim();
    if (!showAddMember || !query) {
      setProfileSearchLoading(false);
      setProfileResults([]);
      setProfileSearchComplete(false);
      return;
    }

    let active = true;
    const timerId = window.setTimeout(() => {
      void (async () => {
        setProfileSearchLoading(true);
        setError(null);
        try {
          const profiles = await searchProfiles({
            query,
            type: "USER",
            size: 20,
          });
          const assignedUserIds = new Set(memberUserIds);
          const nextProfiles = profiles.filter(
            (profile) =>
              Boolean(profile.userId) && !assignedUserIds.has(profile.userId!),
          );
          if (!active) return;
          setProfileResults(nextProfiles);
          setProfileSearchComplete(true);

          const entries = await Promise.all(
            nextProfiles.map(async (profile) => {
              try {
                const avatar = await getProfileAvatar(profile.id);
                return [
                  profile.id,
                  avatar?.thumbnailUrl ||
                    avatar?.url ||
                    profile.avatarUrl ||
                    null,
                ] as const;
              } catch {
                return [profile.id, profile.avatarUrl || null] as const;
              }
            }),
          );
          if (active) {
            setAvatarUrls((current) => ({
              ...current,
              ...Object.fromEntries(entries),
            }));
          }
        } catch (fetchError) {
          if (active) {
            setError(getErrorMessage(fetchError));
            setProfileSearchComplete(false);
          }
        } finally {
          if (active) setProfileSearchLoading(false);
        }
      })();
    }, 150);

    return () => {
      active = false;
      window.clearTimeout(timerId);
    };
  }, [memberUserIds, profileQuery, showAddMember]);
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
      setMemberUserIds(
        result.data?.memberUserIds || nextMembers.map((item) => item.userId),
      );
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
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setLoadingMore(false);
    }
  };
  const normalizedMemberFilter = memberFilter.trim().toLowerCase();
  const filteredMembers = members.filter((member) => {
    if (!normalizedMemberFilter) return true;
    const profile = memberProfiles[member.userId];
    return [
      member.name,
      member.email,
      member.userId,
      profile ? buildProfileLabel(profile) : null,
      profile?.alias,
    ].some((value) => value?.toLowerCase().includes(normalizedMemberFilter));
  });

  return (
    <div className="px-4 px-xl-5 pb-4">
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
      <div
        className="d-flex gap-2 mb-4"
        role="tablist"
        aria-label="Library administration"
      >
        <Button
          variant={tab === "members" ? "dark" : "outline-dark"}
          onClick={() => switchTab("members")}
        >
          Members
        </Button>
        <Button
          variant={tab === "requests" ? "dark" : "outline-dark"}
          onClick={() => switchTab("requests")}
        >
          Role requests
        </Button>
      </div>
      {error && <div className="tempvs-plain-message text-danger">{error}</div>}
      {notice && (
        <div className="tempvs-plain-message text-muted" role="status">
          {notice}
        </div>
      )}
      {loading && <Spinner />}
      {!loading && tab === "members" && (
        <div className="d-flex flex-column gap-3">
          <div className="d-flex align-items-center justify-content-between gap-2">
            <Form.Control
              aria-label="Filter Library members"
              placeholder="Filter members by profile name or alias"
              value={memberFilter}
              onChange={(event) => setMemberFilter(event.target.value)}
              style={{ maxWidth: "28rem" }}
            />
            <IconActionButton
              title="Add Library member"
              onClick={() => {
                setProfileQuery("");
                setProfileResults([]);
                setProfileSearchComplete(false);
                setShowAddMember(true);
              }}
              size="2.4rem"
              fontSize="1rem"
              borderColor="#000"
              color="#000"
              backgroundColor="#fff"
            >
              <PlusIcon />
            </IconActionButton>
          </div>
          {members.length === 0 && (
            <div className="tempvs-plain-message text-muted mb-0">
              No Library roles have been assigned.
            </div>
          )}
          {members.length > 0 && filteredMembers.length === 0 && (
            <div className="tempvs-plain-message text-muted mb-0">
              No Library members match the current filter.
            </div>
          )}
          {filteredMembers.map((member) => {
            const self = member.userId === userInfo?.userId;
            const profile = memberProfiles[member.userId];
            const label = profile
              ? buildProfileLabel(profile)
              : member.name || member.email || "Library member";
            const protectedAdmin = member.role === "ROLE_ADMIN";
            const canChange = !self && !protectedAdmin;
            return (
              <Card key={member.userId} className="border-0 shadow-sm">
                <Card.Body className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
                  <div className="d-flex align-items-center gap-3">
                    <ProfileThumbnail
                      profile={profile}
                      avatarUrl={profile ? avatarUrls[profile.id] : null}
                      label={label}
                    />
                    <div>
                      <div className="fw-semibold">
                        {profile ? (
                          <Link to={`/profile/${profile.alias || profile.id}`}>
                            {label}
                          </Link>
                        ) : (
                          label
                        )}
                      </div>
                      {member.email && (
                        <div className="text-muted small">{member.email}</div>
                      )}
                    </div>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    {protectedAdmin ? (
                      <Form.Control
                        aria-label={`Library role for ${label}`}
                        value={
                          self ? "Library Admin (your role)" : "Library Admin"
                        }
                        disabled
                        readOnly
                        style={{ maxWidth: "15rem" }}
                      />
                    ) : (
                      <Form.Select
                        aria-label={`Library role for ${label}`}
                        value={member.role}
                        disabled={!canChange || updating !== null}
                        onChange={(event) =>
                          void updateMember(member, event.target.value)
                        }
                        style={{ maxWidth: "15rem" }}
                      >
                        {assignableRoleOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Form.Select>
                    )}
                    {canChange && (
                      <IconActionButton
                        title={`Remove ${label} from the Library`}
                        aria-label={`Remove ${label} from the Library`}
                        onClick={() => setMemberPendingRemoval(member)}
                        disabled={updating !== null}
                        size="2.15rem"
                        fontSize="0.9rem"
                        borderColor="#b42318"
                        color="#b42318"
                        backgroundColor="#fff"
                      >
                        <TrashIcon />
                      </IconActionButton>
                    )}
                  </div>
                </Card.Body>
              </Card>
            );
          })}
        </div>
      )}
      <Modal
        show={showAddMember}
        onHide={() => {
          if (!profileSearchLoading && updating === null)
            setShowAddMember(false);
        }}
        centered
      >
        <Modal.Header closeButton={updating === null}>
          <Modal.Title>Add Library member</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted small">
            Search user profiles by name or alias, then choose a Library role.
          </p>
          <Form.Control
            aria-label="Search user profiles to add"
            placeholder="Start typing a name or alias"
            value={profileQuery}
            disabled={updating !== null}
            onChange={(event) => setProfileQuery(event.target.value)}
          />
          {profileSearchLoading && <Spinner />}
          {profileResults.length > 0 && (
            <div className="d-flex flex-column gap-3 mt-3">
              {profileResults.map((profile) => {
                const selectedRole =
                  profileRoleSelection[profile.id] ||
                  assignableRoleOptions[0]?.value;
                const label = buildProfileLabel(profile);
                return (
                  <div
                    key={profile.id}
                    className="d-flex align-items-center justify-content-between gap-2 flex-wrap"
                  >
                    <div className="d-flex align-items-center gap-3">
                      <ProfileThumbnail
                        profile={profile}
                        avatarUrl={avatarUrls[profile.id]}
                        label={label}
                      />
                      <div>
                        <Link
                          className="fw-semibold"
                          to={`/profile/${profile.alias || profile.id}`}
                        >
                          {label}
                        </Link>
                        {profile.alias && (
                          <div className="text-muted small">
                            @{profile.alias}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="d-flex gap-2">
                      <Form.Select
                        aria-label={`Library role to assign to ${label}`}
                        value={selectedRole}
                        disabled={updating !== null}
                        onChange={(event) =>
                          setProfileRoleSelection((current) => ({
                            ...current,
                            [profile.id]: event.target.value,
                          }))
                        }
                        style={{ minWidth: "10rem" }}
                      >
                        {assignableRoleOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Form.Select>
                      <Button
                        variant="dark"
                        disabled={!selectedRole || updating !== null}
                        onClick={() =>
                          void assignProfile(profile, selectedRole)
                        }
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {profileSearchComplete &&
            !profileSearchLoading &&
            profileResults.length === 0 && (
              <div className="text-muted small mt-3">
                No matching user profiles.
              </div>
            )}
        </Modal.Body>
      </Modal>
      <Modal
        show={memberPendingRemoval !== null}
        onHide={() => {
          if (updating === null) setMemberPendingRemoval(null);
        }}
        centered
      >
        <Modal.Header closeButton={updating === null}>
          <Modal.Title>Remove Library member</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Are you sure you want to remove this user from the Library?
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            disabled={updating !== null}
            onClick={() => setMemberPendingRemoval(null)}
          >
            No
          </Button>
          <Button
            variant="danger"
            disabled={updating !== null}
            onClick={() => {
              const member = memberPendingRemoval;
              setMemberPendingRemoval(null);
              if (member) void updateMember(member, "ROLE_USER");
            }}
          >
            Yes
          </Button>
        </Modal.Footer>
      </Modal>
      {!loading && tab === "requests" && (
        <div className="d-flex flex-column gap-3">
          {roleRequests.length === 0 && (
            <div className="tempvs-plain-message text-muted mb-0">
              No pending role requests.
            </div>
          )}
          {roleRequests.map((request) => (
            <Card
              key={`${request.userId}-${request.role}`}
              className="border-0 shadow-sm"
            >
              <Card.Body className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
                <div>
                  <div className="fw-semibold">
                    {request.profileId ? (
                      <Link to={`/profile/${request.profileId}`}>
                        {request.userName}
                      </Link>
                    ) : (
                      request.userName
                    )}
                  </div>
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
          ))}
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
