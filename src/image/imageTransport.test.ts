import { uploadSourceImage, replaceSourceImage } from '../library/libraryApi';
import { uploadAvatar } from '../profile/profileApi';
import { replaceStashItemImage, uploadStashGroupImage, uploadStashItemImage } from '../profile/stashApi';

function emptyResponse() {
  return { ok: true, status: 200, headers: new Headers(), text: async () => '' } as Response;
}

test('all owner services receive image bytes as multipart form data', async () => {
  const fetchMock = jest.spyOn(window, 'fetch').mockResolvedValue(emptyResponse());
  const file = new File(['image'], 'photo.png', { type: 'image/png' });

  await uploadAvatar(1, file, 'avatar');
  await uploadSourceImage(2, file, 'source');
  await replaceSourceImage(2, 'source-image', file, 'replacement');
  await uploadStashItemImage(3, file, 'item');
  await replaceStashItemImage(3, 'item-image', file, 'replacement');
  await uploadStashGroupImage(4, file, 'group');

  const expected = [
    ['/api/profile/profile/1/avatar', 'POST'],
    ['/api/library/source/2/images', 'POST'],
    ['/api/library/source/2/images/source-image', 'PATCH'],
    ['/api/stash/item/3/images', 'POST'],
    ['/api/stash/item/3/images/item-image', 'PATCH'],
    ['/api/stash/group/4/images', 'POST'],
  ];
  expected.forEach(([url, method], index) => {
    const [actualUrl, options] = fetchMock.mock.calls[index];
    expect(actualUrl).toBe(url);
    expect(options?.method).toBe(method);
    expect(options?.body).toBeInstanceOf(FormData);
    expect((options?.body as FormData).get('file')).toBe(file);
    expect(new Headers(options?.headers).has('Content-Type')).toBe(false);
  });
  fetchMock.mockRestore();
});

test('multipart replacement preserves an explicit empty description', async () => {
  const fetchMock = jest.spyOn(window, 'fetch').mockResolvedValue(emptyResponse());
  const file = new File(['image'], 'photo.png', { type: 'image/png' });

  await replaceSourceImage(2, 'source-image', file, '');
  await replaceStashItemImage(3, 'item-image', file, '');
  await uploadAvatar(1, file, '');

  fetchMock.mock.calls.forEach(([, options]) => {
    const body = options?.body as FormData;
    expect(body.has('description')).toBe(true);
    expect(body.get('description')).toBe('');
  });
  fetchMock.mockRestore();
});
