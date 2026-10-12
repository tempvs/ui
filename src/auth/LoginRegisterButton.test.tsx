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
  window.history.pushState({}, '', '/library/source/example?tab=changes');
  show();
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Register' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /sign in with google/i })).toHaveAttribute('href', '/auth/login?provider=Google&returnTo=%2Flibrary%2Fsource%2Fexample%3Ftab%3Dchanges');
});
