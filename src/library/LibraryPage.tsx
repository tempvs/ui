import React from 'react';

import LibraryAdminPage from './pages/LibraryAdminPage';
import LibrarySourceProposalsPage from './pages/LibrarySourceProposalsPage';
import LibraryPendingProposalsPage from './pages/LibraryPendingProposalsPage';
import LibraryLandingPage from './pages/LibraryLandingPage';
import LibraryPeriodPage from './pages/LibraryPeriodPage';
import LibrarySourcePage from './pages/LibrarySourcePage';

type LibraryView = 'landing' | 'period' | 'source' | 'proposals' | 'pending-proposals' | 'admin';

type LibraryPageProps = {
  view?: LibraryView;
};

export default function LibraryPage({ view = 'landing' }: LibraryPageProps) {
  if (view === 'period') {
    return <LibraryPeriodPage />;
  }

  if (view === 'source') {
    return <LibrarySourcePage />;
  }

  if (view === 'admin') {
    return <LibraryAdminPage />;
  }
  if (view === 'proposals') return <LibrarySourceProposalsPage />;
  if (view === 'pending-proposals') return <LibraryPendingProposalsPage />;

  return <LibraryLandingPage />;
}
