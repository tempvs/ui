import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import NotificationButton from './NotificationButton';
import * as api from './notificationApi';

afterEach(() => jest.restoreAllMocks());

test('shows the unread notification count in the header', async () => {
  jest.spyOn(api, 'getUnreadNotificationCount').mockResolvedValue({ count: 12 });
  render(
    <IntlProvider locale="en" messages={{}}>
      <NotificationButton />
    </IntlProvider>,
  );
  await waitFor(() =>
    expect(screen.getByRole('button')).toHaveAccessibleName('Notifications, 12 unread'),
  );
  expect(screen.getByText('12')).toBeInTheDocument();
});
