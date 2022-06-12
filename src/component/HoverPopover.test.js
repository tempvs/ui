import React from 'react';

import { render } from '@testing-library/react';

import HoverPopover from './HoverPopover';

test('renders an app', () => {
  const fallbackMessage = "fallback messagge";
  const hoverPopover = render(
    <HoverPopover text="wrong.key" default={fallbackMessage} />
  );
  expect(hoverPopover.container.textContent).toBe(fallbackMessage);
});
