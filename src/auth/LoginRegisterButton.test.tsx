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

test('sends sign-in and registration to the managed Cognito flow', () => {
  show();
  expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Sign in' })).toHaveAttribute('href', '/auth/login');
  expect(screen.getByRole('button', { name: 'Create account' })).toHaveAttribute('href', '/auth/login?returnTo=/profile');
});
