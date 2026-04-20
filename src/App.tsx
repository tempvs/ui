import React from 'react';
import 'bootstrap/dist/css/bootstrap.css';

import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom';

import './App.css';
import Header from './header/Header';
import ProfilePage from './profile/ProfilePage';
import StashPage from './profile/StashPage';
import LibraryPage from './library/LibraryPage';
import HomePage from './HomePage';
import CompleteRegistrationPage from './auth/CompleteRegistrationPage';

function ProfilePageWithParam() {
  const { id } = useParams();
  return <ProfilePage id={id} />;
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

function App() {
  return (
    <div className="App">
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Header />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/:id" element={<ProfilePageWithParam />} />
          <Route path="/stash/:id" element={<StashPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/library/admin" element={<LibraryAdminPage />} />
          <Route path="/library/period/:period" element={<LibraryPeriodPage />} />
          <Route path="/library/source/:sourceId" element={<LibrarySourcePage />} />
          <Route path="/user/registration/:verificationId" element={<CompleteRegistrationPage />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
