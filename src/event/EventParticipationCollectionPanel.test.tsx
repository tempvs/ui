import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { Club } from '../club/clubApi';
import { Profile } from '../profile/profileTypes';
import { EventApplication } from './eventApi';
import EventParticipationCollectionPanel from './EventParticipationCollectionPanel';

const club: Club = {
  id: 'club-1',
  name: 'Longbow Company',
  alias: 'longbow-company',
  description: null,
  location: null,
  contactEmail: null,
  period: 'HIGH_MIDDLE_AGES',
  creatorUserId: 'user-1',
  adminUserIds: [],
  canManage: false,
  canManageAdmins: false,
};
const profile: Profile = { id: 'profile-1', firstName: 'Robin', lastName: 'Hood', type: 'CLUB' };
const application: EventApplication = {
  id: 'application-1',
  eventId: 'event-1',
  occurrenceId: 'occurrence-1',
  applicantType: 'CLUB',
  clubId: 'club-1',
  profileId: 'profile-1',
  status: 'PENDING',
  attendees: [],
};

function view(renderActions?: (value: EventApplication, valueProfile: Profile) => React.ReactNode) {
  return render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <EventParticipationCollectionPanel
      title="Participation applications"
      applications={[application]}
      profilesById={{ 'profile-1': profile }}
      clubsById={{ 'club-1': club }}
      filterPlaceholder="Filter applications"
      emptyText="No applications."
      renderActions={renderActions}
    />
  </MemoryRouter>);
}

test('renders club participation as a club tile with indented profile tiles', () => {
  const rendered = view();

  expect(screen.getByRole('link', { name: 'Longbow Company' })).toHaveAttribute('href', '/clubs/longbow-company');
  expect(screen.getByRole('link', { name: 'Robin Hood' })).toHaveAttribute('href', '/profile/profile-1');
  const group = rendered.container.querySelector('.event-club-participation')!;
  expect(group.querySelector('.club-thumbnail-link')).toBeInTheDocument();
  expect(group.querySelector('.event-club-participant-profiles .profile-thumbnail-link')).toBeInTheDocument();
});

test('filters grouped participation by club or profile and preserves application actions', () => {
  const action = jest.fn();
  view((value, valueProfile) => <button onClick={() => action(value, valueProfile)}>Approve</button>);

  fireEvent.change(screen.getByRole('searchbox', { name: 'Filter applications' }), { target: { value: 'robin' } });
  fireEvent.click(within(screen.getByRole('region', { name: 'Participation applications' })).getByRole('button', { name: 'Approve' }));
  expect(action).toHaveBeenCalledWith(application, profile);

  fireEvent.change(screen.getByRole('searchbox', { name: 'Filter applications' }), { target: { value: 'missing' } });
  expect(screen.getByText('No participation records match this filter.')).toBeInTheDocument();
});
