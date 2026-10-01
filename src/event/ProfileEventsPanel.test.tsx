import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import ProfileEventsPanel from './ProfileEventsPanel';
import * as api from './eventApi';

jest.mock('./eventApi', () => ({
  ...jest.requireActual('./eventApi'),
  getFollowedEvents: jest.fn(),
  getParticipatingEvents: jest.fn(),
}));

test('followed events use the shared relationship section and filter', async () => {
  const getFollowedEvents = api.getFollowedEvents as jest.MockedFunction<typeof api.getFollowedEvents>;
  getFollowedEvents.mockResolvedValue({ content: [
    { id: 'autumn', name: 'Autumn Fair', description: '', ownerProfileId: 'one', periods: [], schedule: { kind: 'ONE_TIME', startsAt: '', endsAt: '', timeZone: 'UTC' }, adminProfileIds: [], image: null, isActive: true, createdAt: '', updatedAt: '', version: 1 },
    { id: 'winter', name: 'Winter Market', description: '', ownerProfileId: 'one', periods: [], schedule: { kind: 'ONE_TIME', startsAt: '', endsAt: '', timeZone: 'UTC' }, adminProfileIds: [], image: null, isActive: true, createdAt: '', updatedAt: '', version: 1 },
  ] });

  render(<MemoryRouter><ProfileEventsPanel profileId="profile-1" kind="followed" /></MemoryRouter>);

  const filter = await screen.findByRole('searchbox', { name: 'Filter followed events' });
  expect(screen.getByRole('region', { name: 'Events' })).toHaveClass('profile-relationship-panel');
  fireEvent.change(filter, { target: { value: 'winter' } });
  expect(screen.getByRole('link', { name: 'Winter Market' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Autumn Fair' })).not.toBeInTheDocument();
});
