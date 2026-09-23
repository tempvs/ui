import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import RefreshingImage from './RefreshingImage';

test('shows an hourglass while an uploaded image is still being processed', () => {
  render(<RefreshingImage image={{ id: 'image-1' }} alt="Club" />);

  expect(screen.getByRole('status', { name: 'Uploading Club' })).toBeInTheDocument();
});

test('loads a signed URL when a known image has no URL in the owner response', async () => {
  const fetchMock = jest.spyOn(window, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ content: [{ url: 'https://s3/club-photo' }] }),
  } as Response);
  const view = render(
    <RefreshingImage
      image={{ id: 'image-1', resourceType: 'club', resourceId: 'club-1' }}
      fallbackSrc="/placeholder.png"
      alt="Club"
    />,
  );

  await waitFor(() => expect(view.getByRole('img')).toHaveAttribute('src', 'https://s3/club-photo'));
  expect(fetchMock).toHaveBeenCalledWith('/api/images/club/club-1?limit=1&imageIds=image-1');
  fetchMock.mockRestore();
});

test('looks up an unknown profile avatar once instead of treating it as a pending upload', async () => {
  jest.useFakeTimers();
  const fetchMock = jest.spyOn(window, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ content: [] }),
  } as Response);
  render(
    <RefreshingImage
      image={{ resourceType: 'profile', resourceId: 'profile-1' }}
      fallbackSrc="/placeholder.png"
      alt="Profile"
    />,
  );

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  act(() => { jest.advanceTimersByTime(60_000); });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fetchMock.mockRestore();
  jest.useRealTimers();
});

test('keeps polling a pending image until processing provides a signed URL', async () => {
  const fetchMock = jest.spyOn(window, 'fetch')
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: [{ id: 'image-1', status: 'PENDING' }] }),
    } as Response)
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: [{ id: 'image-1', status: 'READY', url: 'https://s3/ready-image' }] }),
    } as Response);
  const view = render(
    <RefreshingImage
      image={{ id: 'image-1', resourceType: 'source', resourceId: 'source-1' }}
      fallbackSrc="/placeholder.png"
      alt="Source"
    />,
  );

  await waitFor(
    () => expect(view.getByRole('img')).toHaveAttribute('src', 'https://s3/ready-image'),
    { timeout: 2_000 },
  );
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock).toHaveBeenLastCalledWith('/api/images/source/source-1?limit=1&imageIds=image-1');
  fetchMock.mockRestore();
});

test('refetches expired metadata once and uses the new signed thumbnail URL', async () => {
  const fetchMock = jest.spyOn(window, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ content: [{ thumbnailUrl: 'https://s3/new-thumbnail' }] }),
  } as Response);
  const view = render(
    <RefreshingImage
      image={{
        id: 'image-1',
        resourceType: 'club',
        resourceId: 7,
        thumbnailUrl: 'https://s3/expired-thumbnail',
      }}
      variant="thumbnail"
      alt="Club"
    />,
  );
  const image = view.getByRole('img');

  fireEvent.error(image);

  await waitFor(() => expect(image).toHaveAttribute('src', 'https://s3/new-thumbnail'));
  expect(fetchMock).toHaveBeenCalledWith('/api/images/club/7?limit=1&imageIds=image-1');

  fireEvent.error(image);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fetchMock.mockRestore();
});

test('falls back after the one metadata refresh fails', async () => {
  const fetchMock = jest.spyOn(window, 'fetch').mockResolvedValue({ ok: false } as Response);
  const view = render(
    <RefreshingImage
      image={{ resourceType: 'profile', resourceId: 2, url: 'https://s3/expired' }}
      fallbackSrc="/placeholder.png"
      alt="Profile"
    />,
  );
  const image = view.getByRole('img');

  fireEvent.error(image);

  await waitFor(() => expect(image).toHaveAttribute('src', '/placeholder.png'));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fetchMock.mockRestore();
});
