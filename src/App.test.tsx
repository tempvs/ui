import React from 'react';
import { render } from '@testing-library/react';
import { IntlProvider } from 'react-intl';

import App from './App';

test('renders an app', () => {
  render(
    <IntlProvider locale="en" messages={{}}>
      <App />
    </IntlProvider>
  );
  expect(document.querySelector('a[href="/library"]')).toBeInTheDocument();
  expect(document.querySelector('a[href="/clubs"]')).toBeInTheDocument();
});

test('uses relative same-origin paths while rendering the application shell', () => {
  const fetch = jest.spyOn(window, 'fetch').mockResolvedValue({ status: 404, text: async () => '' } as Response);

  render(<IntlProvider locale="en" messages={{}}><App /></IntlProvider>);

  expect(fetch).toHaveBeenCalledWith('/api/user/me', expect.anything());
  for (const [url] of fetch.mock.calls) {
    expect(String(url)).toMatch(/^\//);
  }
  fetch.mockRestore();
});
