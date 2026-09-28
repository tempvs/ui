import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import TextFilterInput from './TextFilterInput';

test('passes changed filter text to its caller', () => {
  const onChange = jest.fn();

  render(
    <TextFilterInput
      value="helmet"
      onChange={onChange}
      placeholder="Filter items"
    />,
  );

  fireEvent.change(screen.getByPlaceholderText('Filter items'), { target: { value: 'sword' } });

  expect(onChange).toHaveBeenCalledWith('sword');
});
