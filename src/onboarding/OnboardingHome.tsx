import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button } from "react-bootstrap";
import { Link, useSearchParams } from "react-router-dom";

import { getFollowedClubs, getProfileClubs } from "../club/clubApi";
import { getFollowedEvents, getParticipatingEvents } from "../event/eventApi";
import {
  getClubProfiles,
  getFollowingProfiles,
  getOnboardingPreferences,
  getOnboardingStatus,
  markOnboardingCelebrated,
  getUserProfileByUserId,
  setOnboardingDismissed,
} from "../profile/profileApi";
import { getGroupItemsByIds, getProfileStash } from "../profile/stashApi";
import type { Profile } from "../profile/profileTypes";
import Spinner from "../component/Spinner";
import WallPage from "../wall/WallPage";
import OnboardingProgress from "./OnboardingProgress";

import "./onboarding.css";

type OnboardingStatus = {
  personaCount: number;
  itemCount: number;
  sourcedItemCount: number;
  connectionCount: number;
  partial?: boolean;
};

const emptyStatus: OnboardingStatus = {
  personaCount: 0,
  itemCount: 0,
  sourcedItemCount: 0,
  connectionCount: 0,
  partial: false,
};

function hiddenKey(userId: string) {
  return `tempvs:onboarding:wall:${userId}`;
}

async function loadStatus(userId: string): Promise<OnboardingStatus> {
  const [personalProfile, clubProfiles] = await Promise.all([
    getUserProfileByUserId(userId),
    getClubProfiles(userId),
  ]);
  const personas = clubProfiles.filter((profile) => profile.type === "CLUB");
  const stashes = await Promise.all(personas.map((profile) => getProfileStash(profile.id)));
  const groups = stashes.flatMap((stash) => stash.groups || []);
  const itemsByGroup = await getGroupItemsByIds(groups.map((group) => group.id));
  const items = Array.from(itemsByGroup.values()).flat();
  const connectionProfiles = [...(personalProfile ? [personalProfile] : []), ...personas];
  const relationshipPages = await Promise.all(
    connectionProfiles.map(async (profile) => {
      const results = await Promise.allSettled([
        getFollowingProfiles(profile.id),
        getFollowedClubs(profile.id),
        getProfileClubs(profile.id),
        getFollowedEvents(String(profile.id)),
        getParticipatingEvents(String(profile.id)),
      ]);
      return results.reduce((count, result) => {
        if (result.status !== "fulfilled") return count;
        const value = result.value;
        return count + (Array.isArray(value) ? value.length : value.content?.length || 0);
      }, 0);
    }),
  );
  return {
    personaCount: personas.length,
    itemCount: items.length,
    sourcedItemCount: items.filter((item) => (item.sources || []).length > 0).length,
    connectionCount: relationshipPages.reduce((total, count) => total + count, 0),
  };
}

type Step = {
  id: string;
  title: string;
  description: string;
  action: string;
  to: string;
  complete: boolean;
};

function WallSuggestions() {
  return (
    <section className="onboarding-wall-suggestions" aria-labelledby="wall-suggestions-title">
      <h3 id="wall-suggestions-title">Find your community</h3>
      <p>Follow a club, profile, or event to bring relevant updates here.</p>
      <div className="onboarding-explore-actions">
        <Link className="btn btn-outline-secondary btn-sm" to="/clubs">Explore clubs</Link>
        <Link className="btn btn-outline-secondary btn-sm" to="/events">Find events</Link>
        <Link className="btn btn-outline-secondary btn-sm" to="/map">Explore the map</Link>
      </div>
    </section>
  );
}

function NextSuggestions({ persona }: { persona: Profile | null }) {
  const periodQuery = persona?.period ? `?period=${encodeURIComponent(persona.period)}` : "";
  return (
    <section className="onboarding-next-suggestions mx-4 mx-xl-5 mt-4" aria-labelledby="next-suggestions-title">
      <div>
        <h2 id="next-suggestions-title">Keep building your Tempvs home</h2>
        <p>These are optional ways to make your profile and Wall more useful.</p>
      </div>
      <div className="onboarding-explore-actions">
        {persona && <Link className="btn btn-outline-secondary btn-sm" to={`/profile/${persona.alias || persona.id}`}>Share an update</Link>}
        <Link className="btn btn-outline-secondary btn-sm" to={`/events${periodQuery}`}>{persona?.period ? "Events for this period" : "Explore events"}</Link>
        <Link className="btn btn-outline-secondary btn-sm" to={`/clubs${periodQuery}`}>{persona?.period ? "Clubs for this period" : "Discover clubs"}</Link>
      </div>
    </section>
  );
}

function firstPersona(profiles: Profile[]) {
  return profiles.find((profile) => profile.type === "CLUB") || null;
}

export default function OnboardingHome({ userId }: { userId: string }) {
  const [searchParams] = useSearchParams();
  const requestedResume = searchParams.get("setup") === "1";
  const [status, setStatus] = useState<OnboardingStatus>(emptyStatus);
  const [personas, setPersonas] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showWall, setShowWall] = useState(
    () => !requestedResume && window.localStorage.getItem(hiddenKey(userId)) === "true",
  );
  const [celebrated, setCelebrated] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const [nextStatus, nextProfiles, preferences] = await Promise.all([
        getOnboardingStatus().catch(() => loadStatus(userId)),
        getClubProfiles(userId),
        getOnboardingPreferences(),
      ]);
      setStatus(nextStatus);
      setPersonas(nextProfiles.filter((profile) => profile.type === "CLUB"));
      window.dispatchEvent(new Event("tempvs:onboarding-status-changed"));
      if (preferences.dismissedAt && !requestedResume) setShowWall(true);
      setCelebrated(Boolean(preferences.celebratedAt));
    } catch {
      setError("We could not load your setup progress. Your wall is still available.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // The user ID is the only input to the initial progress read. Actions take
    // the member back home, where this component is mounted again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedResume, userId]);

  useEffect(() => {
    if (!requestedResume) return;
    window.localStorage.removeItem(hiddenKey(userId));
    setShowWall(false);
    void setOnboardingDismissed(false).catch(() => undefined);
  }, [requestedResume, userId]);

  const persona = firstPersona(personas);
  const steps = useMemo<Step[]>(
    () => [
      {
        id: "persona",
        title: "Add a reenactment profile",
        description: "Create a persona for a period, impression, or group.",
        action: "Create a profile",
        to: "/profile?returnTo=%2F",
        complete: status.personaCount > 0,
      },
      {
        id: "item",
        title: "Document an item",
        description: "Add clothing, armour, weapons, or equipment to its collection.",
        action: "Open owned items",
        to: persona
          ? `/stash/${persona.alias || persona.id}?returnTo=%2F`
          : "/profile?returnTo=%2F",
        complete: status.itemCount > 0,
      },
      {
        id: "evidence",
        title: "Link a Library source to an item",
        description: "In Owned items, open an item and choose Add source to link the evidence behind it.",
        action: persona ? "Open owned items" : "Create a profile",
        to: persona
          ? `/stash/${persona.alias || persona.id}?returnTo=%2F`
          : "/profile?returnTo=%2F",
        complete: status.sourcedItemCount > 0,
      },
      {
        id: "community",
        title: "Connect with the community",
        description: "Follow a profile, club, or event—or join a club—to personalise your wall.",
        action: "Explore clubs",
        to: "/clubs",
        complete: status.connectionCount > 0,
      },
    ],
    [persona, status],
  );
  const completeSteps = steps.filter((step) => step.complete).length;
  const ready = completeSteps === steps.length;

  useEffect(() => {
    if (!ready || showWall || celebrated) return;
    setCelebrated(true);
    setShowCelebration(true);
    void markOnboardingCelebrated().catch(() => undefined);
  }, [celebrated, ready, showWall]);

  const openWall = () => {
    window.localStorage.setItem(hiddenKey(userId), "true");
    setShowWall(true);
    void setOnboardingDismissed(true).catch(() => undefined);
  };
  const resumeGuide = () => {
    window.localStorage.removeItem(hiddenKey(userId));
    setShowWall(false);
    void setOnboardingDismissed(false).catch(() => undefined);
    void refresh();
  };

  if (loading && !showWall) {
    return <div className="home-message-panel"><Spinner size="sm" /></div>;
  }

  if (error && !showWall) {
    return (
      <>
        <Alert variant="warning" className="mx-4 mx-xl-5 mt-4">
          {error} <Button variant="link" className="p-0 align-baseline" onClick={() => void refresh()}>Try again</Button>
        </Alert>
        <WallPage userId={userId} emptyContent={<WallSuggestions />} />
      </>
    );
  }

  if (ready || showWall) {
    return (
      <>
        {ready && !showWall && showCelebration && (
          <section className="onboarding-ready mx-4 mx-xl-5 mt-4" role="status">
            <strong>Your Tempvs home is ready.</strong> Your Wall will now grow
            from the people, clubs, events, and sources you follow.
          </section>
        )}
        {!ready && (
          <section className="onboarding-resume mx-4 mx-xl-5 mt-4" aria-label="Setup progress">
            <OnboardingProgress completed={completeSteps} total={steps.length} label="Profile setup" countLabel="foundations complete" compact status={loading ? "loading" : error ? "unavailable" : "ready"} />
            <Button variant="link" className="p-0" onClick={resumeGuide}>Resume setup</Button>
          </section>
        )}
        {ready && <NextSuggestions persona={persona} />}
        <WallPage userId={userId} emptyContent={<WallSuggestions />} />
      </>
    );
  }

  return (
    <main className="onboarding-home px-4 px-xl-5 pb-4">
      <section className="onboarding-hero">
        <p className="onboarding-kicker">Welcome to Tempvs</p>
        <h1>Bring your history to life</h1>
        <p className="onboarding-hero-intro">
          Build a historically grounded reenactment profile, document the kit
          behind it, and connect with people and events.
        </p>
        <p className="onboarding-how-it-works">
          One account can hold several reenactment profiles; each reenactment
          profile can document items with photos or your own equipment,
          supported by shared Library sources. Sources are public: but only
          members with the appropriate role can propose improvements, which
          are reviewed before publication.
        </p>
        <OnboardingProgress completed={completeSteps} total={steps.length} label="Profile setup" countLabel="foundations complete" />
        {status.partial && (
          <p className="onboarding-partial-status" role="status">
            Some setup details are still updating. Your completed work is safe;
            refresh this page in a moment for the latest progress.
          </p>
        )}
      </section>

      <section className="onboarding-steps" aria-label="Get started">
        {steps.map((step, index) => (
          <article key={step.id} className={`onboarding-step${step.complete ? " onboarding-step-complete" : ""}`}>
            <div className="onboarding-step-number" aria-hidden="true">{step.complete ? "✓" : index + 1}</div>
            <div>
              <h2>{step.title}</h2>
              <p>{step.description}</p>
            </div>
            {step.complete ? <span className="onboarding-complete">Complete</span> : <Link className="btn btn-outline-dark btn-sm" to={step.to}>{step.action}</Link>}
          </article>
        ))}
      </section>

      <section className="onboarding-explore" aria-labelledby="explore-tempvs">
        <div>
          <h2 id="explore-tempvs">Explore Tempvs</h2>
          <p>Browsing is always open—find people, places, events, and the research behind them.</p>
        </div>
        <div className="onboarding-explore-actions">
          <Link className="btn btn-outline-secondary" to="/clubs">Clubs</Link>
          <Link className="btn btn-outline-secondary" to="/events">Events</Link>
          <Link className="btn btn-outline-secondary" to="/map">Map</Link>
          <Link className="btn btn-outline-secondary" to="/library">Library</Link>
        </div>
      </section>
      <Button variant="link" className="onboarding-wall-action" onClick={openWall}>Show my wall now</Button>
    </main>
  );
}
