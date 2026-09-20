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

test('Google sign-in has no password or registration fallback', () => {
  show();
  expect(screen.getByRole('button', { name: /continue with google/i })).toHaveAttribute('href', '/api/user/oauth2/authorization/google');
  expect(screen.queryByRole('tab', { name: /register/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: /email/i })).not.toBeInTheDocument();
});
