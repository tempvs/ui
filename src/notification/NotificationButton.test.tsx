import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
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

test('refreshes the badge when a mutation completes and ignores an older in-flight count', async()=>{
 let resolveOld: (value:{count:number})=>void=()=>{};
 const old=new Promise<{count:number}>(resolve=>{resolveOld=resolve;});
 const count=jest.spyOn(api,'getUnreadNotificationCount').mockReturnValueOnce(old).mockResolvedValueOnce({count:0});
 render(<IntlProvider locale='en' messages={{}}><NotificationButton/></IntlProvider>);
 act(()=>{window.dispatchEvent(new Event(api.NOTIFICATIONS_CHANGED));});
 await waitFor(()=>expect(count).toHaveBeenCalledTimes(2));
 await act(async()=>{resolveOld({count:12});await old;});
 expect(screen.getByRole('button')).toHaveAccessibleName('Notifications');
 expect(screen.queryByText('12')).not.toBeInTheDocument();
});
