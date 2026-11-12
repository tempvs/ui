import React from "react";
import { createRoot } from "react-dom/client";
import { IntlProvider } from "react-intl";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.css";
import "../../src/App.css";
import LibraryPage from "../../src/library/LibraryPage";
import OnboardingHome from "../../src/onboarding/OnboardingHome";

createRoot(document.getElementById("root")!).render(
  <IntlProvider locale="en" messages={{}} onError={() => undefined}>
    <BrowserRouter>
      <Routes>
        <Route path="/onboarding-fixture" element={<OnboardingHome userId="profile-learner" />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route
          path="/library/period/:period"
          element={<LibraryPage view="period" />}
        />
      </Routes>
    </BrowserRouter>
  </IntlProvider>,
);
