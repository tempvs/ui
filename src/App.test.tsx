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

test('warms up club-service with the other Render services', () => {
  const fetch = jest.spyOn(window, 'fetch').mockResolvedValue({ status: 404, text: async () => '' } as Response);

  render(<IntlProvider locale="en" messages={{}}><App /></IntlProvider>);

  expect(fetch).toHaveBeenCalledWith('https://tempvs-club.onrender.com/', {
    method: 'GET',
    mode: 'no-cors',
    cache: 'no-store',
  });
  fetch.mockRestore();
});
