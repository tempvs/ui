import React from 'react';
import ThumbnailList, { ThumbnailEntry } from '../component/ThumbnailList';
import { Club } from './clubApi';

export default function ClubThumbnailList({ clubs, renderActions }: { clubs: Club[]; renderActions?: (club: Club) => React.ReactNode }) {
  return <ThumbnailList items={clubs} getKey={club => String(club.id)} className="club-member-list profile-club-list mb-0"
    renderItem={club => <>
      <ThumbnailEntry to={`/clubs/${club.alias || club.id}`} label={club.name} className="club-thumbnail-link" imageClassName="club-list-thumbnail"
        image={{ id: club.photoImageId, resourceType: 'club', resourceId: club.id, url: club.photoUrl, thumbnailUrl: club.photoThumbnailUrl }}
      />
    {renderActions?.(club)}
  </>} />;
}
