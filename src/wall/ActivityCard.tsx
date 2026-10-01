import React from 'react';
import { Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FaTimes } from 'react-icons/fa';

import { DEFAULT_HOURGLASS_IMAGE_SRC } from '../component/DefaultHourglassImage';
import IconActionButton from '../component/IconActionButton';
import RefreshingImage from '../image/RefreshingImage';
import { WallActivity } from './wallApi';

const CloseIcon = FaTimes as React.ComponentType<{ 'aria-hidden'?: boolean }>;
const reasonLabels: Record<string, string> = {
  OWN_PROFILE: 'Your profile', FOLLOWED_PROFILE: 'Followed profile', FOLLOWED_CLUB: 'Followed club',
  CLUB_MEMBER: 'Club membership', FOLLOWED_EVENT: 'Followed event', EVENT_PARTICIPANT: 'Event participation', SOURCE_USED: 'Source in your collection',
};

export default function ActivityCard({ activity, onDismiss }: { activity: WallActivity; onDismiss: (activity: WallActivity) => void }) {
  const resourceType = activity.targetType.toLowerCase();
  return <article className="wall-activity-card">
    <Link to={activity.path} className="wall-activity-thumbnail-link" aria-label={`Open ${activity.title}`}>
      <RefreshingImage image={{ resourceType, resourceId: activity.targetId }} variant="thumbnail" fallbackSrc={DEFAULT_HOURGLASS_IMAGE_SRC} className="wall-activity-thumbnail" alt="" />
    </Link>
    <div className="wall-activity-content">
      <div className="wall-activity-heading">
        <div>
          <Link to={activity.path} className="wall-activity-title">{activity.title}</Link>
          {activity.edited && <span className="wall-edited">Edited</span>}
        </div>
        <IconActionButton title="Dismiss update" onClick={() => onDismiss(activity)} size="1.8rem" fontSize="0.68rem"><CloseIcon aria-hidden /></IconActionButton>
      </div>
      {activity.summary && <p className="wall-activity-summary">{activity.summary}</p>}
      {activity.changes && <dl className="wall-changes">{Object.entries(activity.changes).map(([field, change]) => <React.Fragment key={field}><dt>{field}</dt><dd>{change.before || '—'} → {change.after || '—'}</dd></React.Fragment>)}</dl>}
      <div className="wall-activity-meta">
        <time dateTime={activity.occurredAt}>{new Date(activity.occurredAt).toLocaleString()}</time>
        {(activity.reasons || []).map(reason => <Badge bg="light" text="dark" key={reason}>{reasonLabels[reason] || reason}</Badge>)}
      </div>
    </div>
  </article>;
}
