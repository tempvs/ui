import React from 'react';
import { createRoot } from 'react-dom/client';
import { IntlProvider } from 'react-intl';
import { MemoryRouter } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../../src/App.css';
import '../../src/club/clubs.css';
import '../../src/event/events.css';
import ProfileFollowingPanel from '../../src/profile/components/ProfileFollowingPanel';
import ProfileClubPanel from '../../src/club/ProfileClubPanel';
import ProfileEventsPanel from '../../src/event/ProfileEventsPanel';
import ProfileItemsPanel from '../../src/profile/components/ProfileItemsPanel';
import PhotoAlbumsPanel from '../../src/component/PhotoAlbumsPanel';

const profiles = Array.from({ length: 30 }, (_, index) => ({ id: `profile-${index}`, firstName: `Profile ${index}`, avatarUrl: '/thumb.svg' }));

createRoot(document.getElementById('root')!).render(<IntlProvider locale="en" messages={{}}>
  <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <main style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', maxWidth: '1100px', margin: 'auto', padding: '1rem' }}>
      <div data-testid="profiles"><ProfileFollowingPanel profiles={profiles} loaded t={(_id, message) => message} /></div>
      <div data-testid="clubs"><ProfileClubPanel profileId="fixture" editable={false} /></div>
      <div data-testid="followed-events"><ProfileEventsPanel profileId="fixture" kind="followed" /></div>
      <div data-testid="event-memberships"><ProfileEventsPanel profileId="fixture" kind="participating" /></div>
      <div data-testid="items"><ProfileItemsPanel profileId="fixture" editable t={(_id, message) => message} /></div>
      <div data-testid="albums"><PhotoAlbumsPanel targetType="profile" targetId="fixture" editable={false} /></div>
    </main>
  </MemoryRouter>
</IntlProvider>);
