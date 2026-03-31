import React from 'react';
import 'bootstrap/dist/css/bootstrap.css';

import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom';

import './App.css';
import Header from './header/Header';
import ProfilePage from './profile/ProfilePage';
import LibraryPage from './library/LibraryPage';
import HomePage from './HomePage';

function ProfilePageWithParam() {
  const { id } = useParams();
  return <ProfilePage id={id} />;
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
          <Route path="/library" element={<LibraryPage />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
