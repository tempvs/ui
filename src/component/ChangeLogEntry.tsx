import { Button } from "react-bootstrap";
import { Link } from "react-router-dom";

import { formatAppDateTime } from "../i18n/appLocale";
import { buildProfileLabel } from "../profile/currentProfile";
import type { Profile } from "../profile/profileTypes";

type Props = {
  actorUserId: string;
  proposerUserId?: string;
  action: string;
  occurredAt: string;
  currentUserId?: string | null;
  profiles: Record<string, Profile>;
  detailLabel?: string;
  onDetails?: () => void;
};

/** Shared audit-row chrome for source and place histories. */
export default function ChangeLogEntry({
  actorUserId,
  proposerUserId,
  action,
  occurredAt,
  currentUserId,
  profiles,
  detailLabel,
  onDetails,
}: Props) {
  const user = (id: string) => {
    const profile = profiles[id];
    return (
      <Link
        to={
          profile
            ? `/profile/${profile.alias || profile.id}`
            : `/profile/user/${id}`
        }
      >
        {id === currentUserId
          ? "You"
          : profile
            ? buildProfileLabel(profile)
            : "Unknown profile"}
      </Link>
    );
  };
  return (
    <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap">
      <div>
        {user(actorUserId)} {action}
        {proposerUserId && (
          <>
            <span className="text-muted">, proposed by </span>
            {user(proposerUserId)}
          </>
        )}{" "}
        <time className="text-muted">{formatAppDateTime(occurredAt)}</time>
      </div>
      {onDetails && (
        <Button size="sm" variant="outline-dark" onClick={onDetails}>
          {detailLabel || "View changes"}
        </Button>
      )}
    </div>
  );
}
