import React, { useEffect, useState } from "react";
import { Button, Card, Form } from "react-bootstrap";
import { FaTrash } from "react-icons/fa";
import { Link } from "react-router-dom";

import IconActionButton from "../../component/IconActionButton";
import SectionBreadcrumb from "../../component/SectionBreadcrumb";
import Spinner from "../../component/Spinner";
import { buildProfileLabel } from "../../profile/currentProfile";
import { searchProfiles } from "../../profile/profileApi";
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
import { canManageAllLibraryRoles } from "../libraryRoles";

type AdminTab = "members" | "requests";
const ROLE_OPTIONS = [
  { value: "ROLE_CONTRIBUTOR", label: "Contributor" },
  { value: "ROLE_SCRIBE", label: "Scribe" },
  { value: "ROLE_ARCHIVARIUS", label: "Archivarius" },
  { value: "ROLE_ADMIN", label: "Library Admin" },
];
const TrashIcon = FaTrash as React.ComponentType<{ className?: string }>;

export default function LibraryAdminPage() {
  const [tab, setTab] = useState<AdminTab>("members");
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<LibraryMember[]>([]);
  const [userInfo, setUserInfo] = useState<LibraryUserInfoPayload>(null);
  const [roleRequests, setRoleRequests] = useState<LibraryRoleRequest[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [profileQuery, setProfileQuery] = useState("");
  const [profileResults, setProfileResults] = useState<Profile[]>([]);
  const [profileSearchLoading, setProfileSearchLoading] = useState(false);
  const [profileSearchComplete, setProfileSearchComplete] = useState(false);
  const [profileRoleSelection, setProfileRoleSelection] = useState<
    Record<string, string>
  >({});

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
      setMembers(result.data?.members || []);
      setUserInfo(result.userInfo);
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
  }, []);
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
      setMembers(result.data?.members || []);
      setNotice(
        "Library role updated. The member must refresh their session before new permissions appear.",
      );
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setUpdating(null);
    }
  };
  const searchUserProfiles: React.FormEventHandler<HTMLFormElement> = async (
    event,
  ) => {
    event.preventDefault();
    const query = profileQuery.trim();
    if (!query) {
      setProfileResults([]);
      setProfileSearchComplete(false);
      return;
    }
    setProfileSearchLoading(true);
    setError(null);
    setNotice(null);
    try {
      const profiles = await searchProfiles({ query, type: "USER", size: 20 });
      setProfileResults(profiles.filter((profile) => Boolean(profile.userId)));
      setProfileSearchComplete(true);
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
      setProfileSearchComplete(false);
    } finally {
      setProfileSearchLoading(false);
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
      setMembers(result.data?.members || []);
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
              { label: "Admin", to: "/library/admin" },
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
          {(() => {
            const assignableRoleOptions = canManageAllLibraryRoles(userInfo)
              ? ROLE_OPTIONS
              : ROLE_OPTIONS.filter((option) =>
                  ["ROLE_CONTRIBUTOR", "ROLE_SCRIBE"].includes(option.value),
                );
            return (
              <>
                <Card className="border-0 shadow-sm">
                  <Card.Body>
                    <Card.Title className="fs-5">
                      Assign a Library role
                    </Card.Title>
                    <Card.Text className="text-muted small">
                      Search a user profile by name or alias, then assign an
                      allowed Library role.
                    </Card.Text>
                    <Form
                      className="d-flex gap-2 flex-wrap"
                      onSubmit={searchUserProfiles}
                    >
                      <Form.Control
                        aria-label="Search user profiles"
                        placeholder="Search user profiles"
                        value={profileQuery}
                        onChange={(event) => {
                          setProfileQuery(event.target.value);
                          setProfileSearchComplete(false);
                        }}
                        style={{ maxWidth: "28rem" }}
                      />
                      <Button
                        type="submit"
                        variant="outline-dark"
                        disabled={profileSearchLoading || updating !== null}
                      >
                        {profileSearchLoading ? "Searching..." : "Search"}
                      </Button>
                    </Form>
                    {profileResults.length > 0 && (
                      <div className="d-flex flex-column gap-2 mt-3">
                        {profileResults.map((profile) => {
                          const selectedRole =
                            profileRoleSelection[profile.id] ||
                            assignableRoleOptions[0]?.value;
                          return (
                            <div
                              key={profile.id}
                              className="d-flex align-items-center justify-content-between gap-2 flex-wrap"
                            >
                              <div>
                                <Link
                                  className="fw-semibold"
                                  to={`/profile/${profile.alias || profile.id}`}
                                >
                                  {buildProfileLabel(profile)}
                                </Link>
                                <div className="text-muted small">
                                  {profile.alias
                                    ? `@${profile.alias}`
                                    : profile.id}
                                </div>
                              </div>
                              <div className="d-flex gap-2">
                                <Form.Select
                                  aria-label={`Library role to assign to ${buildProfileLabel(profile)}`}
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
                                    <option
                                      key={option.value}
                                      value={option.value}
                                    >
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
                                  Assign
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
                  </Card.Body>
                </Card>
                {members.length === 0 && (
                  <div className="tempvs-plain-message text-muted mb-0">
                    No Library roles have been assigned.
                  </div>
                )}
                {members.map((member) => {
                  const self = member.userId === userInfo?.userId;
                  return (
                    <Card key={member.userId} className="border-0 shadow-sm">
                      <Card.Body className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
                        <div>
                          <div className="fw-semibold">
                            {member.name || member.email || member.userId}
                          </div>
                          <div className="text-muted small">
                            {member.email || member.userId}
                          </div>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                          <Form.Select
                            aria-label={`Library role for ${member.name || member.email || member.userId}`}
                            value={member.role}
                            disabled={self || updating !== null}
                            onChange={(event) =>
                              void updateMember(member, event.target.value)
                            }
                            style={{ maxWidth: "15rem" }}
                          >
                            {assignableRoleOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                                {self ? " (your role)" : ""}
                              </option>
                            ))}
                          </Form.Select>
                          {!self && (
                            <IconActionButton
                              title={`Remove ${member.name || member.email || "member"} from the Library`}
                              aria-label={`Remove ${member.name || member.email || member.userId} from the Library`}
                              onClick={() =>
                                void updateMember(member, "ROLE_USER")
                              }
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
                        {self && (
                          <div className="w-100 text-muted small">
                            Your Library Admin role is visible but cannot be
                            changed from this panel.
                          </div>
                        )}
                      </Card.Body>
                    </Card>
                  );
                })}
              </>
            );
          })()}
        </div>
      )}
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
