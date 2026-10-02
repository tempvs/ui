import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { getClub } from '../club/clubApi';
import { fetchProfileById } from '../profile/profileApi';
import {
  getEventApplications,
  getEventFollowers,
  getEventParticipants,
  removeEventClubParticipation,
} from './eventApi';
import EventPeoplePanels from './EventPeoplePanels';

jest.mock('../club/clubApi', () => ({ getClub: jest.fn() }));
jest.mock('../profile/profileApi', () => ({ fetchProfileById: jest.fn() }));
jest.mock('./eventApi', () => ({
  decideEventApplication: jest.fn(),
  getEventApplications: jest.fn(),
  getEventFollowers: jest.fn(),
  getEventParticipants: jest.fn(),
  removeEventClubParticipation: jest.fn(),
  unfollowEvent: jest.fn(),
}));

const mockGetClub = getClub as jest.MockedFunction<typeof getClub>;
const mockFetchProfileById = fetchProfileById as jest.MockedFunction<typeof fetchProfileById>;
const mockGetEventApplications = getEventApplications as jest.MockedFunction<typeof getEventApplications>;
const mockGetEventFollowers = getEventFollowers as jest.MockedFunction<typeof getEventFollowers>;
const mockGetEventParticipants = getEventParticipants as jest.MockedFunction<typeof getEventParticipants>;
const mockRemoveEventClubParticipation = removeEventClubParticipation as jest.MockedFunction<typeof removeEventClubParticipation>;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetEventFollowers.mockResolvedValue({ content: [] });
  mockGetEventApplications.mockResolvedValue({ content: [] });
  mockGetEventParticipants.mockResolvedValue({
    content: [{
      id: 'application-1',
      eventId: 'event-1',
      occurrenceId: 'occurrence-1',
      applicantType: 'CLUB',
      clubId: 'club-1',
      profileId: 'profile-1',
      status: 'APPROVED',
      attendees: [],
    }],
  });
  mockGetClub.mockResolvedValue({
    id: 'club-1',
    name: 'Longbow Company',
    description: null,
    location: null,
    contactEmail: null,
    period: 'HIGH_MIDDLE_AGES',
    creatorUserId: 'user-1',
    adminUserIds: [],
    canManage: false,
    canManageAdmins: false,
  });
  mockFetchProfileById.mockImplementation((_id, callbacks) => callbacks.onSuccess({
    id: 'profile-1',
    firstName: 'Robin',
    lastName: 'Hood',
    type: 'CLUB',
  }));
  mockRemoveEventClubParticipation.mockResolvedValue({ removed: 1 });
});

test('lets an event admin remove a club while preserving its participants', async () => {
  const onChanged = jest.fn();
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <EventPeoplePanels eventId="event-1" canManage revision={0} onChanged={onChanged} />
  </MemoryRouter>);

  fireEvent.click(await screen.findByRole('button', { name: 'Remove club participation' }));
  expect(screen.getByText(/together with all its participants/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Remove club only' }));

  await waitFor(() => expect(mockRemoveEventClubParticipation).toHaveBeenCalledWith(
    'event-1',
    'club-1',
    'KEEP_PARTICIPANTS',
  ));
  expect(onChanged).toHaveBeenCalledTimes(1);
});
