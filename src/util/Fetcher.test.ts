import { doFetch } from './Fetcher';

test('renders learn react link', async () => {
  const event = {
    target: document.createElement('form'),
  };

  const actions = {
    200: () => true,
  };

  jest.spyOn(global, 'fetch').mockImplementation(() => Promise.resolve({ status: 200 } as Response));

  doFetch('/api/user/login', 'POST', event, actions);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('reports an unhandled request error through the shared notice event', async () => {
  const notices: CustomEvent[] = [];
  const receive = (event: Event) => notices.push(event as CustomEvent);
  window.addEventListener('tempvs:app-notice', receive);
  jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('offline'));

  doFetch('/api/user/login', 'POST', null);
  await Promise.resolve();
  await Promise.resolve();

  expect(notices).toHaveLength(1);
  expect(notices[0].detail).toMatchObject({
    message: 'Something went wrong. Please try again.',
    tone: 'error',
  });
  window.removeEventListener('tempvs:app-notice', receive);
});
