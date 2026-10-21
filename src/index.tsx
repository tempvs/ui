import React from 'react';
import { createRoot } from 'react-dom/client';
import { IntlProvider } from 'react-intl';

import './index.css';
import App from './App';
import * as serviceWorker from './serviceWorker';
import { appLocaleMessages, resolveAppLocale } from './i18n/appLocale';

const language = resolveAppLocale(navigator.language);
const messages = appLocaleMessages(language);
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found.');
}

const root = createRoot(rootElement);
root.render(
  <IntlProvider locale={language} messages={messages}>
    <App />
  </IntlProvider>
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
