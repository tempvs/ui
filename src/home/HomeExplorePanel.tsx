import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { listClubs, type Club } from "../club/clubApi";
import { formatHistoricalRange } from "../component/HistoricalRangeFilter";
import { listEvents, type TempvsEvent } from "../event/eventApi";
import { findSources, type LibrarySource } from "../library/libraryApi";

type Preview = {
  label: string;
  name: string;
  detail?: string;
  to: string;
};

function upcomingEvent(events: TempvsEvent[]): TempvsEvent | undefined {
  const now = Date.now();
  return [...events]
    .filter((event) => !event.schedule.startsAt || Date.parse(event.schedule.startsAt) >= now)
    .sort(
      (left, right) =>
        Date.parse(left.schedule.startsAt || "9999-12-31") -
        Date.parse(right.schedule.startsAt || "9999-12-31"),
    )[0];
}

function eventPreview(event?: TempvsEvent): Preview | null {
  if (!event) return null;
  const startsAt = event.schedule.startsAt
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
        new Date(event.schedule.startsAt),
      )
    : "Date to be announced";
  return { label: "Upcoming event", name: event.name, detail: startsAt, to: `/events/${event.id}` };
}

function clubPreview(club?: Club): Preview | null {
  if (!club) return null;
  return {
    label: "Club to explore",
    name: club.name,
    detail: club.location || formatHistoricalRange(club.from, club.to),
    to: `/clubs/${club.alias || club.id}`,
  };
}

function sourcePreview(source?: LibrarySource): Preview | null {
  if (!source) return null;
  return {
    label: "Source to explore",
    name: source.name || "Untitled source",
    detail: formatHistoricalRange(source.from, source.to),
    to: `/library/source/${source.id}`,
  };
}

/** A light public discovery panel used on both the landing page and member wall. */
export default function HomeExplorePanel() {
  const [previews, setPreviews] = useState<Preview[]>([]);

  useEffect(() => {
    let active = true;
    void Promise.allSettled([
      listEvents(),
      listClubs(),
      findSources({ query: "", size: 3 }),
    ]).then(([events, clubs, sources]) => {
      if (!active) return;
      const next = [
        events.status === "fulfilled" ? eventPreview(upcomingEvent(events.value.content)) : null,
        clubs.status === "fulfilled" ? clubPreview(clubs.value.content[0]) : null,
        sources.status === "fulfilled" ? sourcePreview(sources.value.data[0]) : null,
      ].filter((preview): preview is Preview => preview !== null);
      setPreviews(next);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="home-explore" aria-labelledby="home-explore-title">
      <div className="home-explore-heading">
        <div>
          <p className="home-explore-kicker">Explore Tempvs</p>
          <h2 id="home-explore-title">Choose a place to begin</h2>
        </div>
        <p>Browse the living map, research sources, local clubs, and events.</p>
      </div>
      <div className="home-explore-links">
        <Link to="/map" className="home-explore-link">
          <span>Map</span>
          <small>Find people, places, events, and sources.</small>
        </Link>
        <Link to="/library" className="home-explore-link">
          <span>Sources</span>
          <small>Explore the research behind historical interpretations.</small>
        </Link>
        <Link to="/clubs" className="home-explore-link">
          <span>Clubs</span>
          <small>Meet groups and their historical focus.</small>
        </Link>
        <Link to="/events" className="home-explore-link">
          <span>Upcoming events</span>
          <small>Plan your next gathering or reenactment.</small>
        </Link>
      </div>
      {previews.length > 0 && (
        <div className="home-curated-preview" aria-label="Featured places to explore">
          {previews.map((preview) => (
            <Link key={`${preview.label}:${preview.to}`} to={preview.to} className="home-preview-link">
              <span>{preview.label}</span>
              <strong>{preview.name}</strong>
              {preview.detail && <small>{preview.detail}</small>}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
