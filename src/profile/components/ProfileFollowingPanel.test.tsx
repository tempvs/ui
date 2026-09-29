import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { MemoryRouter } from 'react-router-dom';

import ProfileFollowingPanel from './ProfileFollowingPanel';

test('filters followed profiles with the shared text filter', () => {
  render(<IntlProvider locale="en" messages={{}}><MemoryRouter>
    <ProfileFollowingPanel
      profiles={[
        { id: '1', firstName: 'Alex', lastName: 'Archer', alias: 'longbow-alex' },
        { id: '2', firstName: 'Robin', lastName: 'Hood', alias: 'sherwood' },
      ]}
      loaded
      canFollow={false}
      isFollowing={false}
      t={(_key, defaultMessage) => defaultMessage}
      onToggleFollow={() => {}}
    />
  </MemoryRouter></IntlProvider>);

  fireEvent.change(screen.getByRole('searchbox', { name: 'Filter profiles' }), { target: { value: 'sherwood' } });

  expect(screen.getByRole('link', { name: 'Robin Hood' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Alex Archer' })).not.toBeInTheDocument();
});
