import React from 'react';

import LibraryAdminPage from './pages/LibraryAdminPage';
import LibraryLandingPage from './pages/LibraryLandingPage';
import LibraryPeriodPage from './pages/LibraryPeriodPage';
import LibrarySourcePage from './pages/LibrarySourcePage';

export default function LibraryPage({ view = 'landing' }) {
  if (view === 'period') {
    return <LibraryPeriodPage />;
  }

  if (view === 'source') {
    return <LibrarySourcePage />;
  }

  if (view === 'admin') {
    return <LibraryAdminPage />;
  }

  return <LibraryLandingPage />;
}
