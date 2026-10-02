import React from 'react';
import { Link } from 'react-router-dom';

import { DEFAULT_HOURGLASS_IMAGE_SRC } from '../component/DefaultHourglassImage';
import RefreshingImage from '../image/RefreshingImage';
import { Club } from './clubApi';

export default function ClubThumbnailList({ clubs, renderActions }: { clubs: Club[]; renderActions?: (club: Club) => React.ReactNode }) {
  return <ul className="club-member-list profile-club-list mb-0">{clubs.map(club => <li key={club.id}>
    <Link className="club-thumbnail-link" to={`/clubs/${club.alias || club.id}`}>
      <RefreshingImage
        image={{ id: club.photoImageId, resourceType: 'club', resourceId: club.id, url: club.photoUrl, thumbnailUrl: club.photoThumbnailUrl }}
        variant="thumbnail"
        fallbackSrc={DEFAULT_HOURGLASS_IMAGE_SRC}
        className="club-list-thumbnail"
        alt=""
        loading="lazy"
      />
      <span>{club.name}</span>
    </Link>
    {renderActions?.(club)}
  </li>)}</ul>;
}
