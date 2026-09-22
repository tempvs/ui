import React from 'react';
import 'bootstrap/dist/css/bootstrap.css';

import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom';

import './App.css';
import Header from './header/Header';
import ProfilePage from './profile/ProfilePage';
import StashPage from './profile/StashPage';
import StashItemPage from './profile/StashItemPage';
import LibraryPage from './library/LibraryPage';
import HomePage from './HomePage';
import ChatPage from './chat/ChatPage';
import ClubsPage from './club/ClubsPage';
import ClubPage from './club/ClubPage';

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

function ChatConversationPage() {
  return <ChatPage />;
}

function ClubPageWithParam() {
  const { id } = useParams();
  return <ClubPage key={id} />;
}

function App() {
  return (
    <div className="App">
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Header />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/user/:userId" element={<UserProfilePageWithParam />} />
          <Route path="/profile/:id" element={<ProfilePageWithParam />} />
          <Route path="/stash/:id" element={<StashPage />} />
          <Route path="/stash/:id/items/:itemId" element={<StashItemPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/library/admin" element={<LibraryAdminPage />} />
          <Route path="/library/period/:period" element={<LibraryPeriodPage />} />
          <Route path="/library/source/:sourceId" element={<LibrarySourcePage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/clubs" element={<ClubsPage />} />
          <Route path="/clubs/:id" element={<ClubPageWithParam />} />
          <Route path="/chat/:conversationId" element={<ChatConversationPage />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
