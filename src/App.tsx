import React from 'react';
import 'bootstrap/dist/css/bootstrap.css';

import { BrowserRouter, Outlet, Route, Routes, useParams } from 'react-router-dom';

import './App.css';
import { PageShellContext } from './component/PageHeader';
import Header from './header/Header';
import ProfilePage from './profile/ProfilePage';
import StashPage from './profile/StashPage';
import StashItemPage from './profile/StashItemPage';
import LibraryPage from './library/LibraryPage';
import HomePage from './HomePage';
import ChatPage from './chat/ChatPage';
import ClubsPage from './club/ClubsPage';
import ClubPage from './club/ClubPage';
import ClubAdminPage from './club/ClubAdminPage';
import EventsPage from './event/EventsPage';
import EventPage from './event/EventPage';
import EventAdminPage from './event/EventAdminPage';
import NotificationsPage from './notification/NotificationsPage';

function ProfilePageWithParam() {
  const { id } = useParams();
  return <ProfilePage key={`profile:${id || ''}`} id={id} />;
}

function UserProfilePageWithParam() {
  const { userId } = useParams();
  return <ProfilePage key={`user-profile:${userId || ''}`} userId={userId} />;
}

function LibraryPeriodPage() {
  return <LibraryPage view="period" />;
}

function LibrarySourcePage() {
  return <LibraryPage view="source" />;
}

function LibraryAdminPage() {
  return <LibraryPage view="admin" />;
}
function LibrarySourceProposalsPage() { return <LibraryPage view="proposals" />; }
function LibraryPendingProposalsPage() { return <LibraryPage view="pending-proposals" />; }

function ChatConversationPage() {
  return <ChatPage />;
}

function ClubPageWithParam() {
  const { id } = useParams();
  return <ClubPage key={id} />;
}

/** Keeps the horizontal navigation mounted while React Router swaps page content. */
function AppShell() {
  const [headerMount, setHeaderMount] = React.useState<HTMLDivElement | null>(null);
  return <>
    <Header />
    <div ref={setHeaderMount} className="app-shell-header-slot px-4 px-xl-5" />
    {headerMount && (
      <PageShellContext.Provider value={{ headerMount }}>
        <Outlet />
      </PageShellContext.Provider>
    )}
  </>;
}

function App() {
  return (
    <div className="App">
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/profile/user/:userId" element={<UserProfilePageWithParam />} />
            <Route path="/profile/:id" element={<ProfilePageWithParam />} />
            <Route path="/stash/:id" element={<StashPage />} />
            <Route path="/stash/:id/items/:itemId" element={<StashItemPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/library/admin" element={<LibraryAdminPage />} />
            <Route path="/library/source/:sourceId/proposals" element={<LibrarySourceProposalsPage />} />
            <Route path="/library/period/:period/proposals" element={<LibraryPendingProposalsPage />} />
            <Route path="/library/period/:period" element={<LibraryPeriodPage />} />
            <Route path="/library/source/:sourceId" element={<LibrarySourcePage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/clubs" element={<ClubsPage />} />
            <Route path="/clubs/:id/admin" element={<ClubAdminPage />} />
            <Route path="/clubs/:id" element={<ClubPageWithParam />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/events/:eventId/admin" element={<EventAdminPage />} />
            <Route path="/events/:eventId" element={<EventPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/chat/:conversationId" element={<ChatConversationPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
