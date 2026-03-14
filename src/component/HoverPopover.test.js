import React from 'react';
import { IntlProvider } from 'react-intl';

import { render } from '@testing-library/react';

import HoverPopover from './HoverPopover';

test('renders an app', () => {
  const fallbackMessage = "fallback message";
  const hoverPopover = render(
    <IntlProvider locale="en" messages={{}}>
      <HoverPopover text="wrong.key" default={fallbackMessage} />
    </IntlProvider>
  );
  expect(hoverPopover.container.textContent).toBe(fallbackMessage);
});
