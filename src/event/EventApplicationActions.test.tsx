import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { Club, getProfileClubs } from '../club/clubApi';
import { applyForEvent, cancelEventApplication } from './eventApi';
import EventApplicationActions from './EventApplicationActions';

jest.mock('../club/clubApi', () => ({ getProfileClubs: jest.fn() }));
jest.mock('./eventApi', () => ({ applyForEvent: jest.fn(), cancelEventApplication: jest.fn() }));

const mockGetProfileClubs = getProfileClubs as jest.MockedFunction<typeof getProfileClubs>;
const mockApplyForEvent = applyForEvent as jest.MockedFunction<typeof applyForEvent>;
const mockCancelEventApplication = cancelEventApplication as jest.MockedFunction<typeof cancelEventApplication>;
const robin = { id: 'profile-1', firstName: 'Robin', lastName: 'Hood', type: 'CLUB' } as const;
const marian = { id: 'profile-2', firstName: 'Marian', lastName: 'Hood', type: 'CLUB' } as const;
const club: Club = { id: 'club-1', name: 'Sherwood Foresters', description: null, location: null, contactEmail: null, period: 'OTHER', creatorUserId: 'user-1', adminUserIds: [], canManage: false, canManageAdmins: false };

function renderActions(applications = {}) {
  const onChange = jest.fn();
  render(<EventApplicationActions
    eventId="event-1"
    occurrenceId="occurrence-1"
    profiles={[robin, marian]}
    applications={applications}
    busy={false}
    onBusy={jest.fn()}
    onError={jest.fn()}
    onChange={onChange}
    onChanged={jest.fn()}
  />);
  return onChange;
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('a rejected participant can submit a new individual event request with the selected profile', async () => {
  mockGetProfileClubs.mockResolvedValue([]);
  mockApplyForEvent.mockResolvedValue({
    id: 'application-1', eventId: 'event-1', occurrenceId: 'occurrence-1', applicantType: 'PROFILE',
    profileId: 'profile-1', status: 'PENDING', attendees: [],
  });
  const onChange = renderActions({
    'profile-1': { id: 'application-1', eventId: 'event-1', occurrenceId: 'occurrence-1', applicantType: 'PROFILE', profileId: 'profile-1', status: 'REJECTED', attendees: [] },
  });

  expect(await screen.findByText('Previous participation ended; you can apply again.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Participate individually' }));

  await waitFor(() => expect(mockApplyForEvent).toHaveBeenCalledWith(
    'event-1', 'occurrence-1', 'profile-1', 'TENTATIVE', 'INDIVIDUAL', undefined,
  ));
  expect(onChange).toHaveBeenCalledWith('profile-1', expect.objectContaining({ status: 'PENDING' }));
});

test('an active participation replaces both apply actions with cancellation for that profile', async () => {
  mockGetProfileClubs.mockResolvedValue([]);
  renderActions({
    'profile-1': { id: 'application-1', eventId: 'event-1', occurrenceId: 'occurrence-1', applicantType: 'PROFILE', profileId: 'profile-1', status: 'APPROVED', attendees: [] },
  });

  expect(await screen.findByText('Approved')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Participate individually' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel participation' }));
  fireEvent.click(screen.getAllByRole('button', { name: 'Cancel participation' }).at(-1)!);
  await waitFor(() => expect(mockCancelEventApplication).toHaveBeenCalledWith('event-1', 'occurrence-1', 'profile-1'));
});

test('club participation uses the only eligible profile without another profile picker', async () => {
  mockGetProfileClubs.mockImplementation(profileId => Promise.resolve(profileId === 'profile-1' ? [club] : []));
  mockApplyForEvent.mockResolvedValue({
    id: 'application-1', eventId: 'event-1', occurrenceId: 'occurrence-1', applicantType: 'CLUB',
    clubId: 'club-1', profileId: 'profile-1', status: 'CLUB_PENDING', attendees: [],
  });
  renderActions();

  expect(await screen.findByText('Or')).toBeInTheDocument();
  expect(screen.queryByLabelText('Profile representing the club')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Participate with club' }));

  await waitFor(() => expect(mockApplyForEvent).toHaveBeenCalledWith(
    'event-1', 'occurrence-1', 'profile-1', 'TENTATIVE', 'CLUB', 'club-1',
  ));
});

test('club participation lets the user choose when multiple owned profiles belong to the club', async () => {
  mockGetProfileClubs.mockResolvedValue([club]);
  mockApplyForEvent.mockResolvedValue({
    id: 'application-2', eventId: 'event-1', occurrenceId: 'occurrence-1', applicantType: 'CLUB',
    clubId: 'club-1', profileId: 'profile-2', status: 'CLUB_PENDING', attendees: [],
  });
  renderActions();

  await screen.findByLabelText('Profile representing the club');
  fireEvent.click(screen.getByLabelText('Profile representing the club'));
  fireEvent.click(screen.getByText('Marian Hood'));
  fireEvent.click(screen.getByRole('button', { name: 'Participate with club' }));

  await waitFor(() => expect(mockApplyForEvent).toHaveBeenCalledWith(
    'event-1', 'occurrence-1', 'profile-2', 'TENTATIVE', 'CLUB', 'club-1',
  ));
});
