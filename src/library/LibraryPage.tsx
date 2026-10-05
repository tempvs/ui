import React from 'react';

import LibraryAdminPage from './pages/LibraryAdminPage';
import LibrarySourceProposalsPage from './pages/LibrarySourceProposalsPage';
import LibraryPendingProposalsPage from './pages/LibraryPendingProposalsPage';
import LibraryLandingPage from './pages/LibraryLandingPage';
import LibraryPeriodPage from './pages/LibraryPeriodPage';
import LibrarySourcePage from './pages/LibrarySourcePage';
import LibrarySourceEditPage from './pages/LibrarySourceEditPage';
import LibrarySourceChangesetPage from './pages/LibrarySourceChangesetPage';

type LibraryView = 'landing' | 'period' | 'source' | 'source-edit' | 'changeset' | 'proposals' | 'pending-proposals' | 'admin';

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

  if (view === 'source-edit') return <LibrarySourceEditPage />;
  if (view === 'changeset') return <LibrarySourceChangesetPage />;

  if (view === 'admin') {
    return <LibraryAdminPage />;
  }
  if (view === 'proposals') return <LibrarySourceProposalsPage />;
  if (view === 'pending-proposals') return <LibraryPendingProposalsPage />;

  return <LibraryLandingPage />;
}
