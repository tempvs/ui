import React from 'react';
import { act, render } from '@testing-library/react';

import InlineSaveStatus from './InlineSaveStatus';

test('removes a saved checkmark after three seconds', () => {
  jest.useFakeTimers();
  const { container } = render(<InlineSaveStatus status="saved" />);

  expect(container).toHaveTextContent('✓');
  act(() => jest.advanceTimersByTime(3000));
  expect(container).toBeEmptyDOMElement();

  jest.useRealTimers();
});
