import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { getProfileClubs } from '../club/clubApi';
import { applyForEvent } from './eventApi';
import EventApplicationActions from './EventApplicationActions';

jest.mock('../club/clubApi', () => ({
  getProfileClubs: jest.fn(),
}));
jest.mock('./eventApi', () => ({
  applyForEvent: jest.fn(),
  cancelEventApplication: jest.fn(),
}));

const mockGetProfileClubs = getProfileClubs as jest.MockedFunction<typeof getProfileClubs>;
const mockApplyForEvent = applyForEvent as jest.MockedFunction<typeof applyForEvent>;

test('a rejected participant can submit a new event request', async () => {
  mockGetProfileClubs.mockResolvedValue([]);
  mockApplyForEvent.mockResolvedValue({
    id: 'application-1', eventId: 'event-1', occurrenceId: 'occurrence-1', applicantType: 'PROFILE',
    profileId: 'profile-1', status: 'PENDING', attendees: [],
  });
  const onChange = jest.fn();
  render(<EventApplicationActions
    eventId="event-1"
    occurrenceId="occurrence-1"
    profile={{ id: 'profile-1', firstName: 'Robin', lastName: 'Hood', type: 'CLUB' }}
    application={{
      id: 'application-1', eventId: 'event-1', occurrenceId: 'occurrence-1', applicantType: 'PROFILE',
      profileId: 'profile-1', status: 'REJECTED', attendees: [],
    }}
    busy={false}
    onBusy={jest.fn()}
    onError={jest.fn()}
    onChange={onChange}
    onChanged={jest.fn()}
  />);

  expect(screen.getByText('Previous request rejected; you can apply again.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Participate individually' }));

  await waitFor(() => expect(mockApplyForEvent).toHaveBeenCalledWith(
    'event-1', 'occurrence-1', 'profile-1', 'TENTATIVE', 'INDIVIDUAL', undefined,
  ));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'PENDING' }));
});
