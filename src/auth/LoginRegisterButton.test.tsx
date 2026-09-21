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

test('Cognito managed login handles Google and email sign-in', () => {
  show();
  expect(screen.getByRole('button', { name: /continue to sign in/i })).toHaveAttribute('href', '/auth/login');
  expect(screen.queryByRole('tab', { name: /register/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: /email/i })).not.toBeInTheDocument();
});
