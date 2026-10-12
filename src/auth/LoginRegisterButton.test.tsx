import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

test('shows a failed registration as a fixed overlay rather than an in-flow message', async () => {
  const fetchMock = jest.spyOn(window, 'fetch').mockResolvedValueOnce(new Response(
    JSON.stringify({ error: 'An account already exists for this email. Sign in instead.' }),
    { status: 409, headers: { 'Content-Type': 'application/json' } },
  ));
  try {
    show();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'already@example.test' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'StrongPassword1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Register' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveClass('auth-error-popover');
    expect(alert).toHaveTextContent(/already exists/i);
    expect(screen.getByLabelText(/email/i).closest('.auth-form-group')).toContainElement(alert);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/auth/register', expect.anything()));
  } finally {
    fetchMock.mockRestore();
  }
});
