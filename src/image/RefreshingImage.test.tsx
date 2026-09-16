import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react';

import RefreshingImage from './RefreshingImage';

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
