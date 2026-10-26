import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, Form, Modal } from "react-bootstrap";
import { FaPlus, FaTrash } from "react-icons/fa";
import { Link } from "react-router-dom";

import { buildProfileLabel } from "../profile/currentProfile";
import ProfileThumbnailLink from "../profile/components/ProfileThumbnailLink";
import type { Profile } from "../profile/profileTypes";
import ConfirmationModal from "./ConfirmationModal";
import IconActionButton from "./IconActionButton";
import Spinner from "./Spinner";
import TextFilterInput from "./TextFilterInput";

export type RoleMemberOption<TRole extends string> = {
  value: TRole;
  label: string;
};

export type RoleMemberPanelMember<TRole extends string> = {
  userId: string;
  name?: string | null;
  email?: string | null;
  role: TRole;
  protectedRole?: boolean;
};

type RoleMemberPanelProps<TRole extends string> = {
  areaLabel: string;
  members: readonly RoleMemberPanelMember<TRole>[];
  profiles: Record<string, Profile>;
  roleOptions: readonly RoleMemberOption<TRole>[];
  viewerUserId?: string;
  busyUserId: string | null;
  searchProfiles: (query: string) => Promise<Profile[]>;
  onAdd: (profile: Profile, role: TRole) => void;
  onChangeRole: (member: RoleMemberPanelMember<TRole>, role: TRole) => void;
  onRemove: (member: RoleMemberPanelMember<TRole>) => void;
  canChangeMember: (member: RoleMemberPanelMember<TRole>) => boolean;
  filterPlaceholder?: string;
};

const PlusIcon = FaPlus as React.ComponentType<{ className?: string }>;
const TrashIcon = FaTrash as React.ComponentType<{ className?: string }>;

/**
 * Shared administration UI for role-backed products.  Product pages keep
 * authorization and API calls, while the member cards, profile search, role
 * selection, and removal confirmation stay visually and behaviorally aligned.
 */
export default function RoleMemberPanel<TRole extends string>({
  areaLabel,
  members,
  profiles,
  roleOptions,
  viewerUserId,
  busyUserId,
  searchProfiles,
  onAdd,
  onChangeRole,
  onRemove,
  canChangeMember,
  filterPlaceholder = "Filter members by profile name or alias",
}: RoleMemberPanelProps<TRole>) {
  const [filter, setFilter] = useState("");
  const [showAddMember, setShowAddMember] = useState(false);
  const [profileQuery, setProfileQuery] = useState("");
  const [profileResults, setProfileResults] = useState<Profile[]>([]);
  const [profileSearchLoading, setProfileSearchLoading] = useState(false);
  const [profileSearchComplete, setProfileSearchComplete] = useState(false);
  const [profileRoleSelection, setProfileRoleSelection] = useState<
    Record<string, TRole>
  >({});
  const [searchError, setSearchError] = useState("");
  const [memberPendingRemoval, setMemberPendingRemoval] = useState<
    RoleMemberPanelMember<TRole> | null
  >(null);

  const memberUserIds = useMemo(
    () => new Set(members.map((member) => member.userId)),
    [members],
  );
  const normalizedFilter = filter.trim().toLocaleLowerCase();
  const filteredMembers = members.filter((member) => {
    if (!normalizedFilter) return true;
    const profile = profiles[member.userId];
    return [
      member.name,
      member.email,
      member.userId,
      profile ? buildProfileLabel(profile) : null,
      profile?.alias,
    ].some((value) => value?.toLocaleLowerCase().includes(normalizedFilter));
  });

  useEffect(() => {
    const query = profileQuery.trim();
    if (!showAddMember || !query) {
      setProfileResults([]);
      setProfileSearchLoading(false);
      setProfileSearchComplete(false);
      setSearchError("");
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      setProfileSearchLoading(true);
      setSearchError("");
      void searchProfiles(query)
        .then((nextProfiles) => {
          if (!active) return;
          setProfileResults(
            (nextProfiles ?? []).filter(
              (profile) =>
                Boolean(profile.userId) && !memberUserIds.has(profile.userId!),
            ),
          );
          setProfileSearchComplete(true);
        })
        .catch(() => {
          if (active) {
            setSearchError("Unable to search user profiles.");
            setProfileSearchComplete(false);
          }
        })
        .finally(() => {
          if (active) setProfileSearchLoading(false);
        });
    }, 150);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [memberUserIds, profileQuery, searchProfiles, showAddMember]);

  const resetAddModal = () => {
    setProfileQuery("");
    setProfileResults([]);
    setProfileSearchComplete(false);
    setSearchError("");
    setShowAddMember(true);
  };
  const busy = busyUserId !== null;

  return (
    <>
      <div className="d-flex flex-column gap-3">
        <div className="d-flex align-items-center justify-content-between gap-2">
          <div style={{ maxWidth: "28rem", width: "100%" }}>
            <TextFilterInput
              ariaLabel={`Filter ${areaLabel} members`}
              placeholder={filterPlaceholder}
              value={filter}
              onChange={setFilter}
            />
          </div>
          <IconActionButton
            title={`Add ${areaLabel} member`}
            onClick={resetAddModal}
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
            No {areaLabel} roles have been assigned.
          </div>
        )}
        {members.length > 0 && filteredMembers.length === 0 && (
          <div className="tempvs-plain-message text-muted mb-0">
            No {areaLabel} members match the current filter.
          </div>
        )}
        {filteredMembers.map((member) => {
          const self = member.userId === viewerUserId;
          const profile = profiles[member.userId];
          const label = profile
            ? buildProfileLabel(profile)
            : member.name || member.email || `${areaLabel} member`;
          const canChange = canChangeMember(member);
          const protectedRole = Boolean(member.protectedRole);
          return (
            <Card key={member.userId} className="border-0 shadow-sm">
              <Card.Body className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
                <div className="d-flex align-items-center gap-3">
                  {profile ? (
                    <ProfileThumbnailLink profile={profile} displayLabel={false} />
                  ) : (
                    <div className="fw-semibold">{label}</div>
                  )}
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
                  {protectedRole && !canChange ? (
                    <Form.Control
                      aria-label={`${areaLabel} role for ${label}`}
                      value={
                        self
                          ? `${areaLabel} Admin (your role)`
                          : `${areaLabel} Admin`
                      }
                      disabled
                      readOnly
                      style={{ maxWidth: "15rem" }}
                    />
                  ) : (
                    <Form.Select
                      aria-label={`${areaLabel} role for ${label}`}
                      value={member.role}
                      disabled={!canChange || busy}
                      onChange={(event) =>
                        onChangeRole(member, event.target.value as TRole)
                      }
                      style={{ maxWidth: "15rem" }}
                    >
                      {roleOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Form.Select>
                  )}
                  {canChange && (
                    <IconActionButton
                      title={`Remove ${label} from the ${areaLabel}`}
                      aria-label={`Remove ${label} from the ${areaLabel}`}
                      onClick={() => setMemberPendingRemoval(member)}
                      disabled={busy}
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
      <Modal
        show={showAddMember}
        onHide={() => {
          if (!profileSearchLoading && !busy) setShowAddMember(false);
        }}
        centered
      >
        <Modal.Header closeButton={!busy}>
          <Modal.Title>Add {areaLabel} member</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted small">
            Search user profiles by name or alias, then choose a {areaLabel} role.
          </p>
          <Form.Control
            aria-label="Search user profiles to add"
            placeholder="Start typing a name or alias"
            value={profileQuery}
            disabled={busy}
            onChange={(event) => setProfileQuery(event.target.value)}
          />
          {profileSearchLoading && <Spinner size="sm" />}
          {searchError && <div className="text-danger small mt-3">{searchError}</div>}
          {profileResults.length > 0 && (
            <div className="d-flex flex-column gap-3 mt-3">
              {profileResults.map((profile) => {
                const selectedRole =
                  profileRoleSelection[profile.id] || roleOptions[0]?.value;
                const label = buildProfileLabel(profile);
                return (
                  <div
                    key={profile.id}
                    className="d-flex align-items-center justify-content-between gap-2 flex-wrap"
                  >
                    <div className="d-flex align-items-center gap-3">
                      <ProfileThumbnailLink profile={profile} displayLabel={false} />
                      <div>
                        <Link
                          className="fw-semibold"
                          to={`/profile/${profile.alias || profile.id}`}
                        >
                          {label}
                        </Link>
                        {profile.alias && (
                          <div className="text-muted small">@{profile.alias}</div>
                        )}
                      </div>
                    </div>
                    <div className="d-flex gap-2">
                      <Form.Select
                        aria-label={`${areaLabel} role to assign to ${label}`}
                        value={selectedRole}
                        disabled={busy}
                        onChange={(event) =>
                          setProfileRoleSelection((current) => ({
                            ...current,
                            [profile.id]: event.target.value as TRole,
                          }))
                        }
                        style={{ minWidth: "10rem" }}
                      >
                        {roleOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Form.Select>
                      <Button
                        variant="dark"
                        disabled={!selectedRole || busy}
                        onClick={() =>
                          selectedRole && onAdd(profile, selectedRole)
                        }
                      >
                        {busyUserId === profile.userId ? "Adding..." : "Add"}
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
      <ConfirmationModal
        show={memberPendingRemoval !== null}
        title={`Remove ${areaLabel} member`}
        message={`Are you sure you want to remove this user from ${areaLabel} administration?`}
        cancelLabel="No"
        confirmLabel="Yes"
        busy={busy}
        onHide={() => {
          if (!busy) setMemberPendingRemoval(null);
        }}
        onConfirm={() => {
          const member = memberPendingRemoval;
          setMemberPendingRemoval(null);
          if (member) onRemove(member);
        }}
      />
    </>
  );
}
