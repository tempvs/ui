import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ClubsPage from './ClubsPage';
import ClubPage from './ClubPage';
import ProfileClubPanel from './ProfileClubPanel';
import { Club, getJoinOptions, getProfileClubs, listClubs } from './clubApi';

const club: Club = { id: 1, name: 'Longbow Company', description: 'Living history', location: 'York', contactEmail: null,
  period: 'HIGH_MIDDLE_AGES', creatorUserId: 10, adminUserIds: [], canManage: false, canManageAdmins: false };
const response = (data: unknown, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(data) } as Response);

function wrap(child: React.ReactNode, path = '/') {
  return render(<IntlProvider locale="en" messages={{}}><MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{child}</MemoryRouter></IntlProvider>);
}

afterEach(() => jest.restoreAllMocks());

test('clubs page renders the older array response instead of crashing', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(response([club]));
  wrap(<ClubsPage />);
  expect(await screen.findByRole('link', { name: club.name })).toBeInTheDocument();
});

test.each(['', 'null', '<!doctype html><html>UI fallback</html>'])('invalid club response %p does not blank the profile', async body => {
  jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 200, text: async () => body } as Response);
  wrap(<><h1>Club profile</h1><ProfileClubPanel profileId={5} editable /></>);
  const panel = await screen.findByRole('region', { name: 'Clubs' });
  await waitFor(() => expect(panel).toHaveClass('club-service-unavailable'));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Club profile' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Join club' })).toBeDisabled();
});

test('HTML fallback greys and disables the clubs page without an error alert', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 200, text: async () => '<html>UI fallback</html>' } as Response);
  const view = wrap(<ClubsPage />);
  await waitFor(() => expect(screen.getByLabelText('Search clubs')).toBeDisabled());
  expect(view.container.querySelector('.clubs-page')).toHaveClass('club-service-unavailable');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Clubs' })).toBeInTheDocument();
});

test('club details become muted and disabled when a dependency makes club-service unavailable', async () => {
  jest.spyOn(global, 'fetch').mockImplementation(async input => String(input).includes('/participants')
    ? response({ detail: 'Profile service is unavailable' }, 503) : response(club));
  const view = wrap(<Routes><Route path="/clubs/:id" element={<ClubPage />} /></Routes>, '/clubs/1');
  expect(await screen.findByRole('heading', { name: club.name })).toBeInTheDocument();
  expect(view.container.querySelector('.clubs-page')).toHaveClass('club-service-unavailable');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('network failure greys and disables club content without showing fallback copy', async () => {
  jest.spyOn(global, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
  const view = wrap(<ClubsPage />);

  await waitFor(() => expect(screen.getByLabelText('Search clubs')).toBeDisabled());
  expect(view.container.querySelector('.clubs-page')).toHaveClass('club-service-unavailable');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('actionable client errors remain visible and do not disable club content', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(response({ detail: 'The search is invalid' }, 400));
  const view = wrap(<ClubsPage />);

  expect(await screen.findByRole('alert')).toHaveTextContent('The search is invalid');
  expect(screen.getByLabelText('Search clubs')).toBeEnabled();
  expect(view.container.querySelector('.clubs-page')).not.toHaveClass('club-service-unavailable');
});

test('malformed list items and wrong page envelopes fail before reaching React state', async () => {
  const fetch = jest.spyOn(global, 'fetch');
  fetch.mockResolvedValueOnce(response({ content: null, hasMore: false }));
  await expect(listClubs()).rejects.toThrow('unexpected response');
  fetch.mockResolvedValueOnce(response({ content: [{ ...club, name: { invalid: true } }], hasMore: false }));
  await expect(listClubs()).rejects.toThrow('unexpected response');
  fetch.mockResolvedValueOnce(response({ club }));
  await expect(getProfileClubs(5)).rejects.toThrow('unexpected response');
});

test('join options support the old paginated array contract', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(response([{ club, status: 'PENDING' }]));
  await expect(getJoinOptions(5)).resolves.toEqual({ content: [{ club, status: 'PENDING' }], hasMore: false });
});
