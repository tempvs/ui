import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import LoginRegisterButton from './LoginRegisterButton';

function show(googleOnlyAuth: boolean) {
  render(<IntlProvider locale="en" messages={{}}>
    <LoginRegisterButton logIn={() => {}} googleOnlyAuth={googleOnlyAuth} />
  </IntlProvider>);
  fireEvent.click(screen.getByRole('button'));
}

test('Google-only mode hides password and registration tabs', () => {
  show(true);
  expect(screen.getByRole('button', { name: /authenticate with gmail/i })).toHaveAttribute('href', '/api/user/oauth2/authorization/google');
  expect(screen.queryByRole('tab', { name: /register/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: /email/i })).not.toBeInTheDocument();
});

test('legacy mode retains email login and registration until cutover', () => {
  show(false);
  expect(screen.getByRole('tab', { name: /register/i })).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument();
});
