import React from 'react';
import { createRoot } from 'react-dom/client';
import { IntlProvider } from 'react-intl';
import { MemoryRouter } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../../src/index.css';
import '../../src/App.css';
import Header from '../../src/header/Header';

createRoot(document.getElementById('root')!).render(
  <IntlProvider locale="en"><MemoryRouter><Header /><main style={{ minHeight: '100vh' }} /></MemoryRouter></IntlProvider>,
);
