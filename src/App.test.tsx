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

test('warms only services that still run on Render', () => {
  const fetch = jest.spyOn(window, 'fetch').mockResolvedValue({ status: 404, text: async () => '' } as Response);

  render(<IntlProvider locale="en" messages={{}}><App /></IntlProvider>);

  expect(fetch).not.toHaveBeenCalledWith('https://tempvs-club.onrender.com/', expect.anything());
  expect(fetch).not.toHaveBeenCalledWith('https://profile-service-ynnk.onrender.com/', expect.anything());
  expect(fetch).not.toHaveBeenCalledWith('https://tempvs-image-1.onrender.com/', expect.anything());
  expect(fetch).not.toHaveBeenCalledWith('https://stash-service-iri9.onrender.com/', expect.anything());
  fetch.mockRestore();
});
