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

test('profile avatar uses a presigned PUT while legacy owner services still use multipart', async () => {
  const fetchMock = jest.spyOn(window, 'fetch')
    .mockResolvedValueOnce(avatarIntentResponse())
    .mockResolvedValue(emptyResponse());
  const file = new File(['image'], 'photo.png', { type: 'image/png' });

  await uploadAvatar(1, file, 'avatar');
  await uploadSourceImage(2, file, 'source');
  await replaceSourceImage(2, 'source-image', file, 'replacement');
  await uploadStashItemImage(3, file, 'item');
  await replaceStashItemImage(3, 'item-image', file, 'replacement');
  await uploadStashGroupImage(4, file, 'group');

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

  const expected = [
    ['/api/library/source/2/images', 'POST'],
    ['/api/library/source/2/images/source-image', 'PATCH'],
    ['/api/stash/item/3/images', 'POST'],
    ['/api/stash/item/3/images/item-image', 'PATCH'],
    ['/api/stash/group/4/images', 'POST'],
  ];
  expected.forEach(([url, method], index) => {
    const [actualUrl, options] = fetchMock.mock.calls[index + 2];
    expect(actualUrl).toBe(url);
    expect(options?.method).toBe(method);
    expect(options?.body).toBeInstanceOf(FormData);
    expect((options?.body as FormData).get('file')).toBe(file);
    expect(new Headers(options?.headers).has('Content-Type')).toBe(false);
  });
  fetchMock.mockRestore();
});

test('image replacement preserves an explicit empty description', async () => {
  const fetchMock = jest.spyOn(window, 'fetch')
    .mockResolvedValueOnce(emptyResponse())
    .mockResolvedValueOnce(emptyResponse())
    .mockResolvedValueOnce(avatarIntentResponse())
    .mockResolvedValue(emptyResponse());
  const file = new File(['image'], 'photo.png', { type: 'image/png' });

  await replaceSourceImage(2, 'source-image', file, '');
  await replaceStashItemImage(3, 'item-image', file, '');
  await uploadAvatar(1, file, '');

  fetchMock.mock.calls.slice(0, 2).forEach(([, options]) => {
    const body = options?.body as FormData;
    expect(body.has('description')).toBe(true);
    expect(body.get('description')).toBe('');
  });
  expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toMatchObject({ description: '' });
  fetchMock.mockRestore();
});
