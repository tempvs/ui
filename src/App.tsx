import React, { useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.css';

import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom';

import './App.css';
import Header from './header/Header';
import ProfilePage from './profile/ProfilePage';
import StashPage from './profile/StashPage';
import LibraryPage from './library/LibraryPage';
import HomePage from './HomePage';
import CompleteRegistrationPage from './auth/CompleteRegistrationPage';

const WARMUP_URLS = [
  'https://tempvs-image-1.onrender.com/',
  'https://stash-service-iri9.onrender.com/',
  'https://email-service-ova5.onrender.com/',
  'https://user-service-d4or.onrender.com/',
  'https://tempvs-library.onrender.com/',
  'https://profile-service-ynnk.onrender.com/',
  'https://api-gateway-t7bp.onrender.com/',
];

const WARMUP_INTERVAL_MS = 14 * 60 * 1000;

function ProfilePageWithParam() {
  const { id } = useParams();
  return <ProfilePage id={id} />;
}

function UserProfilePageWithParam() {
  const { userId } = useParams();
  return <ProfilePage userId={userId} />;
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

function pingRenderServices() {
  WARMUP_URLS.forEach(url => {
    window.fetch(url, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
    }).catch(() => {});
  });
}

function App() {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    pingRenderServices();

    const intervalId = window.setInterval(() => {
      pingRenderServices();
    }, WARMUP_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

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
