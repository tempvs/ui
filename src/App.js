import React from 'react';
import 'bootstrap/dist/css/bootstrap.css';

import { Router } from '@reach/router';

import './App.css';
import Header from './header/Header';
import ProfilePage from './profile/ProfilePage';
import LibraryPage from './library/LibraryPage';

function App() {
  return (
    <div className="App">
      <Header />
      <Router>
        <ProfilePage path="/" />
        <ProfilePage path="/profile" />
        <ProfilePage path="/profile/:id" />
        <LibraryPage path="/library" />
      </Router>
    </div>
  );
}

export default App;
