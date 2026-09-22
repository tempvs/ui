import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import LoginRegisterButton from './LoginRegisterButton';

function show() {
  render(<IntlProvider locale="en" messages={{}}>
    <LoginRegisterButton />
  </IntlProvider>);
  fireEvent.click(screen.getByRole('button'));
}

test('keeps email sign-in and registration inside the regular UI modal', () => {
  show();
  expect(screen.getByRole('tab', { name: /register/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /continue with google/i })).toHaveAttribute('href', '/auth/login?provider=Google');
  fireEvent.click(screen.getByRole('tab', { name: /register/i }));
  expect(screen.getByRole('button', { name: /continue with google/i })).toHaveAttribute('href', '/auth/login?provider=Google&returnTo=/profile');
});
