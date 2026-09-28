import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import ConfirmationModal from './ConfirmationModal';

test('calls the customized confirmation action', () => {
  const onConfirm = jest.fn();
  render(
    <ConfirmationModal
      show
      title="Unlink source"
      message="Are you sure you want to unlink this source?"
      confirmLabel="Unlink"
      confirmVariant="warning"
      onHide={jest.fn()}
      onConfirm={onConfirm}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Unlink' }));
  expect(onConfirm).toHaveBeenCalledTimes(1);
});
