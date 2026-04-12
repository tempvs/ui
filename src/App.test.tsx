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
  expect(document.querySelector('a')?.getAttribute('href')).toBe('/library');
});
