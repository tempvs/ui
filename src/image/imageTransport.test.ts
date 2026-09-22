import { uploadSourceImage, replaceSourceImage } from '../library/libraryApi';
import { uploadAvatar } from '../profile/profileApi';
import { replaceStashItemImage, uploadStashGroupImage, uploadStashItemImage } from '../profile/stashApi';

function emptyResponse() {
  return { ok: true, status: 200, headers: new Headers(), text: async () => '' } as Response;
}

function avatarIntentResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      upload: {
        url: 'https://uploads.example.com/avatar',
        method: 'PUT',
        headers: { 'content-type': 'image/png' },
      },
    }),
  } as Response;
}

function stashIntentResponse(url: string) {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    text: async () => JSON.stringify({
      image: { id: 'image-id' },
      upload: {
        url,
        method: 'PUT',
        headers: { 'content-type': 'image/png' },
      },
    }),
  } as Response;
}

test('AWS-owned image flows, including Library, use presigned PUTs', async () => {
  const fetchMock = jest.spyOn(window, 'fetch')
    .mockResolvedValueOnce(avatarIntentResponse())
    .mockResolvedValueOnce(emptyResponse())
    .mockResolvedValueOnce(stashIntentResponse('https://uploads.example.com/source'))
    .mockResolvedValueOnce(emptyResponse())
    .mockResolvedValueOnce(stashIntentResponse('https://uploads.example.com/source-replacement'))
    .mockResolvedValueOnce(emptyResponse())
    .mockResolvedValueOnce(stashIntentResponse('https://uploads.example.com/item'))
    .mockResolvedValueOnce(emptyResponse())
    .mockResolvedValueOnce(stashIntentResponse('https://uploads.example.com/replacement'))
    .mockResolvedValueOnce(emptyResponse())
    .mockResolvedValueOnce(stashIntentResponse('https://uploads.example.com/group'))
    .mockResolvedValueOnce(emptyResponse());
  const file = new File(['image'], 'photo.png', { type: 'image/png' });

  await uploadAvatar(1, file, 'avatar');
  await uploadSourceImage('source-2', file, 'source');
  await replaceSourceImage('source-2', 'source-image', file, 'replacement');
  await uploadStashItemImage(3, file, 'item');
  await replaceStashItemImage(3, 'item-image', file, 'replacement');
  const uploadedGroupImage = await uploadStashGroupImage(4, file, 'group');

  expect(uploadedGroupImage).toMatchObject({ id: 'image-id' });

  const [intentUrl, intentOptions] = fetchMock.mock.calls[0];
  expect(intentUrl).toBe('/api/profile/profile/1/avatar');
  expect(intentOptions?.method).toBe('POST');
  expect(JSON.parse(String(intentOptions?.body))).toEqual({
    fileName: 'photo.png',
    contentType: 'image/png',
    byteSize: 5,
    description: 'avatar',
  });
  const [uploadUrl, uploadOptions] = fetchMock.mock.calls[1];
  expect(uploadUrl).toBe('https://uploads.example.com/avatar');
  expect(uploadOptions).toMatchObject({ method: 'PUT', body: file });

  const libraryCalls = [
    ['/api/library/source/source-2/images', 'POST', 'https://uploads.example.com/source'],
    ['/api/library/source/source-2/images/source-image', 'PATCH', 'https://uploads.example.com/source-replacement'],
  ];
  libraryCalls.forEach(([url, method, upload], index) => {
    const offset = 2 + index * 2;
    const [actualUrl, options] = fetchMock.mock.calls[offset];
    expect(actualUrl).toBe(url);
    expect(options?.method).toBe(method);
    expect(new Headers(options?.headers).get('Idempotency-Key')).toBeTruthy();
    expect(JSON.parse(String(options?.body))).toMatchObject({
      fileName: 'photo.png', contentType: 'image/png', byteSize: 5,
    });
    expect(fetchMock.mock.calls[offset + 1][0]).toBe(upload);
    expect(fetchMock.mock.calls[offset + 1][1]).toMatchObject({ method: 'PUT', body: file });
  });

  const stashCalls = [
    ['/api/stash/item/3/images', 'POST', 'https://uploads.example.com/item'],
    ['/api/stash/item/3/images/item-image', 'PATCH', 'https://uploads.example.com/replacement'],
    ['/api/stash/group/4/images', 'POST', 'https://uploads.example.com/group'],
  ];
  stashCalls.forEach(([intent, method, upload], index) => {
    const offset = 6 + index * 2;
    expect(fetchMock.mock.calls[offset][0]).toBe(intent);
    expect(fetchMock.mock.calls[offset][1]?.method).toBe(method);
    expect(JSON.parse(String(fetchMock.mock.calls[offset][1]?.body))).toMatchObject({
      fileName: 'photo.png',
      contentType: 'image/png',
      byteSize: 5,
    });
    expect(fetchMock.mock.calls[offset + 1][0]).toBe(upload);
    expect(fetchMock.mock.calls[offset + 1][1]).toMatchObject({ method: 'PUT', body: file });
  });
  fetchMock.mockRestore();
});

test('image replacement preserves an explicit empty description', async () => {
  const fetchMock = jest.spyOn(window, 'fetch')
    .mockResolvedValueOnce(stashIntentResponse('https://uploads.example.com/source-replacement'))
    .mockResolvedValueOnce(emptyResponse())
    .mockResolvedValueOnce(stashIntentResponse('https://uploads.example.com/replacement'))
    .mockResolvedValueOnce(emptyResponse())
    .mockResolvedValueOnce(avatarIntentResponse())
    .mockResolvedValueOnce(emptyResponse());
  const file = new File(['image'], 'photo.png', { type: 'image/png' });

  await replaceSourceImage('source-2', 'source-image', file, '');
  await replaceStashItemImage(3, 'item-image', file, '');
  await uploadAvatar(1, file, '');

  expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ description: '' });
  expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toMatchObject({ description: '' });
  expect(JSON.parse(String(fetchMock.mock.calls[4][1]?.body))).toMatchObject({ description: '' });
  fetchMock.mockRestore();
});
