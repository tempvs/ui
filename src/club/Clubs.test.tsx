import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ClubPage from './ClubPage';
import ClubsPage from './ClubsPage';
import ProfileClubPanel from './ProfileClubPanel';
import JoinClubModal from './JoinClubModal';
import ClubPhotoPanel from './ClubPhotoPanel';
import * as api from './clubApi';
import * as profileApi from '../profile/profileApi';

jest.mock('./clubApi', () => ({
  ...jest.requireActual('./clubApi'),
  getClub: jest.fn(), getParticipants: jest.fn(), listClubs: jest.fn(), getProfileClubs: jest.fn(),
  getJoinOptions: jest.fn(), requestJoin: jest.fn(), getJoinRequests: jest.fn(), decideJoinRequest: jest.fn(),
  attachProfile: jest.fn(), detachProfile: jest.fn(), updateClub: jest.fn(), deleteClub: jest.fn(),
  addAdmin: jest.fn(), removeAdmin: jest.fn(), createClub: jest.fn(),
  getClubFollowers: jest.fn(), getClubFollowState: jest.fn(), followClub: jest.fn(), unfollowClub: jest.fn(), getFollowedClubs: jest.fn(),
  uploadClubPhoto: jest.fn(), removeClubPhoto: jest.fn(),
}));
jest.mock('../profile/profileApi', () => ({
  fetchCurrentUserInfo: jest.fn(),
  fetchClubProfiles: jest.fn(),
  fetchOwnerUserProfile: jest.fn(),
}));

const club: api.Club = { id: 1, name: 'Longbow Company', description: 'Living history', location: 'York', contactEmail: null,
  period: 'HIGH_MIDDLE_AGES', creatorUserId: 'user-10', adminUserIds: ['user-20'], canManage: false, canManageAdmins: false };
const mock = <T extends (...args: any[]) => any>(fn: T) => fn as jest.MockedFunction<T>;

function wrap(child: React.ReactNode, path = '/') {
  return render(<IntlProvider locale="en" messages={{}}><MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{child}</MemoryRouter></IntlProvider>);
}

beforeEach(() => {
  jest.resetAllMocks();
  mock(profileApi.fetchCurrentUserInfo).mockImplementation(onResult => onResult({ currentUserId: null, oauthProfile: null }));
  mock(profileApi.fetchClubProfiles).mockImplementation((_userId, handlers) => handlers.onSuccess([]));
  mock(profileApi.fetchOwnerUserProfile).mockImplementation((_userId, handlers) => handlers.onSuccess(null));
  mock(api.getClub).mockResolvedValue(club);
  mock(api.getParticipants).mockResolvedValue({ content: [{ id: '5', firstName: 'Alex', lastName: 'Archer', alias: 'alex-archer' }], hasMore: false });
  mock(api.listClubs).mockResolvedValue({ content: [club], hasMore: false });
  mock(api.getJoinRequests).mockResolvedValue({ content: [], hasMore: false });
  mock(api.getJoinOptions).mockResolvedValue({ content: [{ club, status: null }], hasMore: false });
  mock(api.getClubFollowers).mockResolvedValue({ content: [], hasMore: false });
  mock(api.getFollowedClubs).mockResolvedValue([]);
  mock(api.getClubFollowState).mockResolvedValue(false);
});

test('visitors see participants linked to profiles and no management controls', async () => {
  wrap(<Routes><Route path="/clubs/:id" element={<ClubPage />} /></Routes>, '/clubs/1');
  expect(await screen.findByRole('heading', { name: 'Longbow Company' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Alex Archer' })).toHaveAttribute('href', '/profile/alex-archer');
  expect(screen.queryByRole('button', { name: 'Edit club' })).not.toBeInTheDocument();
  expect(screen.queryByText('Assign an admin')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
});

test('a signed-in user can follow and unfollow a club through any owned profile', async () => {
  mock(profileApi.fetchCurrentUserInfo).mockImplementation(onResult => onResult({ currentUserId: 'user-42', oauthProfile: null }));
  mock(profileApi.fetchOwnerUserProfile).mockImplementation((_userId, handlers) => handlers.onSuccess({ id: 'personal-1', firstName: 'Alex', lastName: 'Archer', type: 'USER' }));
  mock(profileApi.fetchClubProfiles).mockImplementation((_userId, handlers) => handlers.onSuccess([{ id: 'club-1', firstName: 'Longbow', lastName: 'Company', type: 'CLUB' }]));
  mock(api.followClub).mockResolvedValue(undefined);
  mock(api.unfollowClub).mockResolvedValue(undefined);
  wrap(<Routes><Route path="/clubs/:id" element={<ClubPage />} /></Routes>, '/clubs/1');
  fireEvent.click(await screen.findByRole('button', { name: 'Follow' }));
  const modal = await screen.findByRole('dialog');
  expect(within(modal).getByText('Alex Archer')).toBeInTheDocument();
  expect(within(modal).getByText('Longbow Company')).toBeInTheDocument();
  fireEvent.click(within(modal).getAllByRole('button', { name: 'Follow' })[0]);
  await waitFor(() => expect(api.followClub).toHaveBeenCalledWith('1', 'personal-1'));
  expect(await within(modal).findByRole('button', { name: 'Unfollow' })).toBeInTheDocument();
  fireEvent.click(within(modal).getByRole('button', { name: 'Unfollow' }));
  await waitFor(() => expect(api.unfollowClub).toHaveBeenCalledWith('1', 'personal-1'));
});

test('profile owners can leave from the scrollable club participant list', async () => {
  mock(profileApi.fetchCurrentUserInfo).mockImplementation(onResult => onResult({ currentUserId: 'user-42', oauthProfile: null }));
  mock(api.getParticipants).mockResolvedValue({ content: [{ id: '5', userId: 'user-42', firstName: 'Alex', lastName: 'Archer' }], hasMore: false });
  mock(api.detachProfile).mockResolvedValue(undefined);
  wrap(<Routes><Route path="/clubs/:id" element={<ClubPage />} /></Routes>, '/clubs/1');
  const leave = await screen.findByRole('button', { name: 'Leave club' });
  expect(screen.getByRole('region', { name: 'Members' })).toHaveClass('club-scroll-list');
  fireEvent.click(leave);
  await waitFor(() => expect(api.detachProfile).toHaveBeenCalledWith('1', '5'));
});

test('scrolling participants appends the next page without pagination buttons', async () => {
  mock(api.getParticipants)
    .mockResolvedValueOnce({ content: [{ id: '5', firstName: 'Alex', lastName: 'Archer' }], hasMore: true, nextToken: 'participants-2' })
    .mockResolvedValueOnce({ content: [{ id: '6', firstName: 'Robin', lastName: 'Hood' }], hasMore: false });
  wrap(<Routes><Route path="/clubs/:id" element={<ClubPage />} /></Routes>, '/clubs/1');
  await screen.findByRole('link', { name: 'Alex Archer' });
  const region = screen.getByRole('region', { name: 'Members' });
  Object.defineProperties(region, {
    scrollTop: { value: 260, configurable: true },
    clientHeight: { value: 100, configurable: true },
    scrollHeight: { value: 320, configurable: true },
  });
  fireEvent.scroll(region);
  expect(await screen.findByRole('link', { name: 'Robin Hood' })).toBeInTheDocument();
  expect(api.getParticipants).toHaveBeenLastCalledWith('1', 'participants-2');
  expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
});

test('admins can edit and manage participants but cannot assign admins or delete clubs', async () => {
  mock(api.getClub).mockResolvedValue({ ...club, canManage: true });
  wrap(<Routes><Route path="/clubs/:id" element={<ClubPage />} /></Routes>, '/clubs/1');
  fireEvent.click(await screen.findByRole('button', { name: 'Edit club' }));
  expect(screen.getByLabelText('Club name')).toHaveValue('Longbow Company');
  expect(screen.getByText('Join requests')).toBeInTheDocument();
  expect(screen.queryByText('Assign an admin')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Delete club' })).not.toBeInTheDocument();
});

test('creator can revoke admin access and sees refreshed management', async () => {
  mock(api.getClub).mockResolvedValue({ ...club, canManage: true, canManageAdmins: true });
  mock(api.removeAdmin).mockResolvedValue({ ...club, adminUserIds: [] });
  wrap(<Routes><Route path="/clubs/:id" element={<ClubPage />} /></Routes>, '/clubs/1');
  expect(await screen.findByText('Assign an admin')).toBeInTheDocument();
  const adminLink = screen.getByRole('link', { name: 'View profile #user-20' });
  fireEvent.click(adminLink.closest('li')!.querySelector('button')!);
  await waitFor(() => expect(api.removeAdmin).toHaveBeenCalledWith('1', 'user-20'));
});

test('owner opens search modal and requests membership without immediately joining', async () => {
  mock(api.getProfileClubs).mockResolvedValue([]);
  mock(api.requestJoin).mockResolvedValue({ id: 9, clubId: 1, profileId: 5, status: 'PENDING', requestedDate: '', profile: null });
  wrap(<ProfileClubPanel profileId={5} period="HIGH_MIDDLE_AGES" editable />);
  expect(screen.queryByRole('textbox', { name: 'Search clubs' })).not.toBeInTheDocument();
  fireEvent.click(await screen.findByRole('button', { name: 'Join club' }));
  const modal = await screen.findByRole('dialog');
  expect(within(modal).getByText('Clubs matching this profile’s period')).toBeInTheDocument();
  await waitFor(() => expect(api.getJoinOptions).toHaveBeenCalledWith(5, '', undefined, expect.any(AbortSignal)));
  fireEvent.click(await within(modal).findByRole('button', { name: 'Request to join' }));
  await waitFor(() => expect(api.requestJoin).toHaveBeenCalledWith(1, 5));
  expect(await within(modal).findByRole('button', { name: 'Request pending' })).toBeDisabled();
  expect(api.attachProfile).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Leave club' })).not.toBeInTheDocument();
});

test('profile visitors see club references without join or leave controls', async () => {
  mock(api.getProfileClubs).mockResolvedValue([{ ...club, photoUrl: '/club-photo' }, { ...club, id: 2, name: 'Second club' }]);
  const view = wrap(<ProfileClubPanel profileId={5} editable={false} />);
  expect(await screen.findByRole('link', { name: 'Longbow Company' })).toHaveAttribute('href', '/clubs/1');
  expect(screen.queryByRole('button', { name: 'Leave club' })).not.toBeInTheDocument();
  expect(screen.queryByText('HIGH_MIDDLE_AGES')).not.toBeInTheDocument();
  expect(view.container.querySelector('.club-list-thumbnail')).toHaveAttribute('src', '/club-photo');
  expect(screen.getByRole('link', { name: 'Second club' })).toHaveAttribute('href', '/clubs/2');
  expect(screen.queryByRole('button', { name: 'Join club' })).not.toBeInTheDocument();
});

test('failed join request keeps the modal available and explains the failure', async () => {
  mock(api.getProfileClubs).mockResolvedValue([]);
  mock(api.requestJoin).mockRejectedValue(new Error('The club and profile must have the same period'));
  wrap(<ProfileClubPanel profileId={5} editable />);
  fireEvent.click(await screen.findByRole('button', { name: 'Join club' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Request to join' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('same period');
  expect(screen.getByRole('button', { name: 'Request to join' })).toBeEnabled();
});

test('unattached profiles render no club section or controls to visitors', async () => {
  mock(api.getProfileClubs).mockResolvedValue([]);
  const view = wrap(<ProfileClubPanel profileId={5} editable={false} />);
  await waitFor(() => expect(api.getProfileClubs).toHaveBeenCalledWith(5));
  expect(view.container).toBeEmptyDOMElement();
});

test('owners with existing memberships still have a join button', async () => {
  mock(api.getProfileClubs).mockResolvedValue([club]);
  wrap(<ProfileClubPanel profileId={5} editable />);
  expect(await screen.findByRole('link', { name: 'Longbow Company' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Join club' })).toBeInTheDocument();
});

test.each(['accept', 'reject'] as const)('club admins can %s a pending request', async decision => {
  mock(api.getClub).mockResolvedValue({ ...club, canManage: true });
  const request: api.JoinRequest = { id: 9, clubId: 1, profileId: '6', status: 'PENDING', requestedDate: '', profile: { id: '6', firstName: 'Robin', lastName: 'Hood' } };
  mock(api.getJoinRequests).mockResolvedValueOnce({ content: [request], hasMore: false })
    .mockResolvedValue({ content: [], hasMore: false });
  mock(api.decideJoinRequest).mockResolvedValue({ ...request, status: decision === 'accept' ? 'ACCEPTED' : 'REJECTED' });
  wrap(<Routes><Route path="/clubs/:id" element={<ClubPage />} /></Routes>, '/clubs/1');
  fireEvent.click(await screen.findByRole('button', { name: decision === 'accept' ? 'Accept' : 'Reject' }));
  await waitFor(() => expect(api.decideJoinRequest).toHaveBeenCalledWith('1', 9, decision));
  expect(await screen.findByText('No pending join requests.')).toBeInTheDocument();
});

test('club browsing searches as the user types and changes period', async () => {
  mock(api.listClubs).mockResolvedValue({ content: [{ ...club, photoUrl: '/club-photo' }], hasMore: false });
  const view = wrap(<ClubsPage />);
  expect(await screen.findByRole('link', { name: 'Longbow Company' })).toHaveAttribute('href', '/clubs/1');
  expect(view.container.querySelector('.club-list-thumbnail')).toHaveAttribute('src', '/club-photo');
  fireEvent.change(screen.getByLabelText('Search clubs'), { target: { value: 'longbow' } });
  expect(screen.queryByRole('button', { name: 'Search' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  await waitFor(() => expect(api.listClubs).toHaveBeenLastCalledWith('longbow', '', undefined, expect.any(AbortSignal)));
  fireEvent.change(screen.getByLabelText('Period'), { target: { value: 'HIGH_MIDDLE_AGES' } });
  await waitFor(() => expect(api.listClubs).toHaveBeenLastCalledWith('longbow', 'HIGH_MIDDLE_AGES', undefined, expect.any(AbortSignal)));
});

test('scrolling the clubs page appends another page and stops at the end', async () => {
  mock(api.listClubs).mockResolvedValueOnce({ content: [club], hasMore: true, nextToken: 'clubs-2' })
    .mockResolvedValueOnce({ content: [{ ...club, id: 2, name: 'Second club' }], hasMore: false });
  const view = wrap(<ClubsPage />);
  await screen.findByRole('link', { name: 'Longbow Company' });
  const sentinel = view.container.querySelector('.clubs-load-sentinel')!;
  jest.spyOn(sentinel, 'getClientRects').mockReturnValue([{ top: 0 }] as unknown as DOMRectList);
  fireEvent.scroll(window);
  await screen.findByRole('link', { name: 'Second club' });
  expect(screen.getByRole('link', { name: 'Longbow Company' })).toBeInTheDocument();
  expect(api.listClubs).toHaveBeenLastCalledWith('', '', 'clubs-2', expect.any(AbortSignal));
  fireEvent.scroll(window);
  expect(api.listClubs).toHaveBeenCalledTimes(2);
});

test('managers upload a club photo and see the saved image', async () => {
  const onChange = jest.fn();
  const saved = {
    ...club,
    canManage: true,
    hasPhoto: true,
    photoImageId: 'image-id',
    photoUrl: 'https://s3/photo',
    photoThumbnailUrl: null,
  };
  mock(api.uploadClubPhoto).mockResolvedValue(saved);
  wrap(<ClubPhotoPanel club={{ ...club, canManage: true }} onChange={onChange} />);
  const file = new File(['photo'], 'club.png', { type: 'image/png' });
  fireEvent.change(screen.getByLabelText('Upload club photo'), { target: { files: [file] } });
  await waitFor(() => expect(api.uploadClubPhoto).toHaveBeenCalledWith(1, file));
  await waitFor(() => expect(onChange).toHaveBeenCalledWith(saved));
});

test('photo uploads reject unsupported files and visitors cannot upload', async () => {
  const view = wrap(<ClubPhotoPanel club={{ ...club, canManage: true }} onChange={() => {}} />);
  fireEvent.change(screen.getByLabelText('Upload club photo'), { target: { files: [new File(['text'], 'file.txt', { type: 'text/plain' })] } });
  expect(await screen.findByRole('alert')).toHaveTextContent('JPEG or PNG');
  expect(api.uploadClubPhoto).not.toHaveBeenCalled();
  view.unmount();
  wrap(<ClubPhotoPanel club={{ ...club, photoUrl: '/photo' }} onChange={() => {}} />);
  expect(screen.getByRole('img', { name: club.name })).toHaveAttribute('src', '/photo');
  expect(screen.queryByLabelText('Replace club photo')).not.toBeInTheDocument();
});

test('club search and profile tiles resolve migrated image IDs through the image API', async () => {
  const photoClub = { ...club, hasPhoto: true, photoImageId: 'club-image-id' };
  mock(api.getJoinOptions).mockResolvedValue({
    content: [{ club: photoClub, status: null }],
    hasMore: false,
  });
  const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ content: [{ id: 'club-image-id', url: '/signed-club-photo' }] }),
  } as Response);
  const view = wrap(<JoinClubModal profileId={5} onClose={() => {}} />);
  await waitFor(() => {
    expect(document.querySelector('.join-club-photo')).toHaveAttribute('src', '/signed-club-photo');
  });
  expect(fetchMock).toHaveBeenCalledWith('/api/images/club/1?limit=1&imageIds=club-image-id');
  fetchMock.mockRestore();
  view.unmount();
});

test('join modal searches as typing settles, with no search, pagination, or close buttons', async () => {
  wrap(<JoinClubModal profileId={5} onClose={() => {}} />);
  await screen.findByRole('link', { name: 'Longbow Company' });
  for (const name of ['Search', 'Previous', 'Next', 'Close']) {
    expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
  }
  const input = screen.getByRole('textbox', { name: 'Search clubs' });
  fireEvent.change(input, { target: { value: 'l' } });
  fireEvent.change(input, { target: { value: 'long' } });
  fireEvent.change(input, { target: { value: 'longbow' } });
  await waitFor(() => expect(api.getJoinOptions).toHaveBeenLastCalledWith(5, 'longbow', undefined, expect.any(AbortSignal)));
  expect(api.getJoinOptions).toHaveBeenCalledTimes(2);
});

test('join tiles append the next server page once and stop when hasMore is false', async () => {
  const firstPage = Array.from({ length: 20 }, (_, index) => ({ club: { ...club, id: index + 1, name: `Club ${index + 1}` }, status: null }));
  let resolveNext!: (page: api.JoinOptionsPage) => void;
  mock(api.getJoinOptions).mockResolvedValueOnce({ content: firstPage, hasMore: true, nextToken: 'join-2' })
    .mockImplementationOnce(() => new Promise(resolve => { resolveNext = resolve; }));
  wrap(<JoinClubModal profileId={5} onClose={() => {}} />);
  await screen.findByRole('link', { name: 'Club 20' });
  const region = screen.getByRole('region', { name: 'Club search results' });
  Object.defineProperties(region, { scrollHeight: { value: 1000 }, clientHeight: { value: 300 }, scrollTop: { value: 750, writable: true } });
  fireEvent.scroll(region);
  fireEvent.scroll(region);
  expect(api.getJoinOptions).toHaveBeenCalledTimes(2);
  expect(api.getJoinOptions).toHaveBeenLastCalledWith(5, '', 'join-2', expect.any(AbortSignal));
  await act(async () => resolveNext({ content: [{ club: { ...club, id: 21, name: 'Club 21' }, status: null }], hasMore: false }));
  expect(screen.getByRole('link', { name: 'Club 1' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Club 21' })).toBeInTheDocument();
  fireEvent.scroll(region);
  expect(api.getJoinOptions).toHaveBeenCalledTimes(2);
});

test('a late response from an old search cannot overwrite the latest tiles', async () => {
  let resolveOld!: (page: api.JoinOptionsPage) => void;
  mock(api.getJoinOptions).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }))
    .mockResolvedValueOnce({ content: [{ club: { ...club, id: 2, name: 'New result' }, status: null }], hasMore: false });
  wrap(<JoinClubModal profileId={5} onClose={() => {}} />);
  await waitFor(() => expect(api.getJoinOptions).toHaveBeenCalledTimes(1));
  const oldSignal = mock(api.getJoinOptions).mock.calls[0][3];
  fireEvent.change(screen.getByRole('textbox', { name: 'Search clubs' }), { target: { value: 'new' } });
  expect(oldSignal?.aborted).toBe(true);
  await screen.findByRole('link', { name: 'New result' });
  await act(async () => resolveOld({ content: [{ club, status: null }], hasMore: true }));
  expect(screen.queryByRole('link', { name: 'Longbow Company' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'New result' })).toBeInTheDocument();
});

test('failed pages can be retried without skipping results', async () => {
  mock(api.getJoinOptions).mockRejectedValueOnce(new Error('Unable to load clubs'))
    .mockResolvedValueOnce({ content: [{ club, status: null }], hasMore: false });
  wrap(<JoinClubModal profileId={5} onClose={() => {}} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
  await screen.findByRole('link', { name: 'Longbow Company' });
  expect(mock(api.getJoinOptions).mock.calls.map(call => call[2])).toEqual([undefined, undefined]);
});

test('clicking outside the modal content closes it', async () => {
  const onClose = jest.fn();
  wrap(<JoinClubModal profileId={5} onClose={onClose} />);
  fireEvent.click(await screen.findByRole('dialog'));
  expect(onClose).toHaveBeenCalledTimes(1);
});
