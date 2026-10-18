import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Form, Modal } from "react-bootstrap";
import { useIntl } from "react-intl";
import { Link, useNavigate } from "react-router-dom";
import { DEFAULT_HOURGLASS_IMAGE_SRC } from "../component/DefaultHourglassImage";
import HistoricalRangeFilter, {
  type HistoricalYearInput,
} from "../component/HistoricalRangeFilter";
import PeriodMultiSelect from "../component/PeriodMultiSelect";
import PageLayout from "../component/PageLayout";
import SectionBreadcrumb from "../component/SectionBreadcrumb";
import RefreshingImage from "../image/RefreshingImage";
import {
  fetchClubProfiles,
  fetchCurrentUserInfo,
  fetchUserProfileByUserId,
} from "../profile/profileApi";
import { Profile } from "../profile/profileTypes";
import { PeriodBadge, type Period } from "../util/periods";
import {
  Club,
  ClubDraft,
  createClub,
  isClubServiceUnavailable,
  listClubs,
} from "./clubApi";
import {
  overlapsHistoricalRange,
  rangeFromInputs,
} from "../search/publicSearchFilterContract";
import ClubForm from "./ClubForm";
import "./clubs.css";

export default function ClubsPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const t = (id: string, defaultMessage: string) =>
    intl.formatMessage({ id: `clubs.${id}`, defaultMessage });
  const [clubs, setClubs] = useState<Club[]>([]);
  const [query, setQuery] = useState("");
  const [selectedPeriods, setSelectedPeriods] = useState<Period[]>([]);
  const [rangeEnabled, setRangeEnabled] = useState(false);
  const [from, setFrom] = useState<HistoricalYearInput>({
    year: "",
    era: "AD",
  });
  const [to, setTo] = useState<HistoricalYearInput>({ year: "", era: "AD" });
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [searchError, setSearchError] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [ownedProfiles, setOwnedProfiles] = useState<Profile[]>([]);
  const sentinel = useRef<HTMLDivElement>(null);
  const loadMore = useRef<() => void>(() => {});
  const matchesRange = useCallback(
    (club: Club) => {
      if (!rangeEnabled || (!from.year && !to.year)) return true;
      return overlapsHistoricalRange(club, rangeFromInputs(from, to));
    },
    [rangeEnabled, from, to],
  );

  useEffect(
    () =>
      fetchCurrentUserInfo((result) => {
        setSignedIn(Boolean(result.currentUserId));
        if (!result.currentUserId) {
          setOwnedProfiles([]);
          return;
        }
        let personal: Profile | null = null;
        let clubs: Profile[] = [];
        const finish = () =>
          setOwnedProfiles([...(personal ? [personal] : []), ...clubs]);
        fetchUserProfileByUserId(result.currentUserId, {
          onSuccess: (profile) => {
            personal = profile;
            finish();
          },
          onMissing: finish,
          onError: finish,
        });
        fetchClubProfiles(result.currentUserId, {
          onSuccess: (profiles) => {
            clubs = profiles;
            finish();
          },
          onError: finish,
        });
      }),
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    let active = true,
      fetching = false,
      ready = false,
      more = true,
      failed = false;
    let nextToken: string | undefined;
    setClubs([]);
    setLoading(true);
    setSearchError("");
    setHasMore(false);
    setUnavailable(false);
    const fetchNext = async (retry = false) => {
      if (!active || !ready || fetching || !more || (failed && !retry)) return;
      fetching = true;
      failed = false;
      setLoading(true);
      setSearchError("");
      try {
        const data = rangeEnabled
          ? await listClubs(
              query.trim(),
              selectedPeriods.length === 1 ? selectedPeriods[0] : "",
              nextToken,
              controller.signal,
              from.year ? { year: Number(from.year), era: from.era } : null,
              to.year ? { year: Number(to.year), era: to.era } : null,
            )
          : await listClubs(
              query.trim(),
              selectedPeriods.length === 1 ? selectedPeriods[0] : "",
              nextToken,
              controller.signal,
            );
        if (!active) return;
        setClubs((current) => {
          const ids = new Set(current.map((club) => club.id));
          return [
            ...current,
            ...data.content.filter(
              (club) =>
                !ids.has(club.id) &&
                matchesRange(club) &&
                (!selectedPeriods.length ||
                  selectedPeriods.includes(club.period)),
            ),
          ];
        });
        nextToken = data.nextToken;
        more = data.hasMore;
        setHasMore(more);
      } catch (e) {
        failed = true;
        if (active) {
          if (isClubServiceUnavailable(e)) setUnavailable(true);
          else setSearchError((e as Error).message);
        }
      } finally {
        fetching = false;
        if (active) setLoading(false);
      }
    };
    loadMore.current = () => fetchNext(true);
    const checkScroll = () => {
      const element = sentinel.current;
      if (
        element &&
        element.getClientRects().length > 0 &&
        element.getBoundingClientRect().top <= window.innerHeight + 200
      )
        fetchNext();
    };
    window.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    const timer = window.setTimeout(() => {
      ready = true;
      fetchNext();
    }, 250);
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
      window.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [query, selectedPeriods, rangeEnabled, from, to, matchesRange]);

  useEffect(() => {
    const element = sentinel.current;
    if (
      !loading &&
      hasMore &&
      !searchError &&
      element &&
      element.getClientRects().length > 0 &&
      element.getBoundingClientRect().top <= window.innerHeight + 200
    ) {
      loadMore.current();
    }
  }, [loading, hasMore, searchError, clubs.length]);

  const save = async (draft: ClubDraft) => {
    setBusy(true);
    setError("");
    try {
      const club = await createClub(draft);
      navigate(`/clubs/${club.alias || club.id}`);
    } catch (e) {
      if (isClubServiceUnavailable(e)) setUnavailable(true);
      else setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <PageLayout
      className={`clubs-page${unavailable ? " club-service-unavailable" : ""}`}
      header={{
        title: <SectionBreadcrumb items={[{ label: t("title", "Clubs") }]} />,
        rightContent: signedIn ? (
          <Button
            variant="secondary"
            disabled={unavailable}
            onClick={() => setCreating(true)}
          >
            {t("create", "Create club")}
          </Button>
        ) : null,
      }}
    >
      {error && !creating && <Alert variant="danger">{error}</Alert>}
      <>
        <div className="club-search-layout">
          <aside className="club-search-filters">
            <HistoricalRangeFilter
              enabled={rangeEnabled}
              from={from}
              to={to}
              onEnabledChange={setRangeEnabled}
              onFromChange={setFrom}
              onToChange={setTo}
              onValueEntered={() => setRangeEnabled(true)}
              label="Years"
              alwaysShowFields
              compact
              inlineToggle
            />
            <PeriodMultiSelect
              ariaLabel={t("period", "Period")}
              selected={selectedPeriods}
              onChange={setSelectedPeriods}
              disabled={unavailable}
              display="checkboxes"
            />
          </aside>
          <div className="club-search-query">
            <Form.Control
              aria-label={t("searchClubs", "Search clubs")}
              placeholder={t("searchClubs", "Search clubs")}
              maxLength={120}
              value={query}
              disabled={unavailable}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="club-card-grid club-search-results">
              {clubs.map((club) => (
                <article key={club.id} className="club-panel">
                  <PeriodBadge period={club.period} />
                  <h2 className="mt-3">
                    <Link
                      className="club-thumbnail-link"
                      to={`/clubs/${club.alias || club.id}`}
                    >
                      <RefreshingImage
                        image={{
                          id: club.photoImageId,
                          resourceType: "club",
                          resourceId: club.id,
                          url: club.photoUrl,
                          thumbnailUrl: club.photoThumbnailUrl,
                        }}
                        variant="thumbnail"
                        fallbackSrc={DEFAULT_HOURGLASS_IMAGE_SRC}
                        className="club-list-thumbnail"
                        alt=""
                        loading="lazy"
                      />
                      <span>{club.name}</span>
                    </Link>
                  </h2>
                  {club.location && (
                    <p className="text-muted">{club.location}</p>
                  )}
                  <p className="club-card-description">{club.description}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
        {loading && <p role="status">{t("searching", "Searching clubs…")}</p>}
        {searchError && (
          <Alert variant="danger">
            {searchError}{" "}
            <Button variant="link" onClick={() => loadMore.current()}>
              {t("retry", "Retry")}
            </Button>
          </Alert>
        )}
        {!loading && !unavailable && !searchError && clubs.length === 0 && (
          <p className="club-panel">
            {t(
              "empty",
              "No clubs found. Start one for your reenactment group.",
            )}
          </p>
        )}
        <div
          ref={sentinel}
          className="clubs-load-sentinel"
          aria-hidden="true"
        />
      </>
      <Modal
        show={creating}
        onHide={() => {
          if (!busy) {
            setCreating(false);
            setError("");
          }
        }}
        centered
      >
        <Modal.Header closeButton={!busy}>
          <Modal.Title>{t("create", "Create club")}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <ClubForm
            busy={busy || unavailable}
            ownerProfiles={ownedProfiles}
            onSave={save}
            onCancel={() => {
              setCreating(false);
              setError("");
            }}
          />
        </Modal.Body>
      </Modal>
    </PageLayout>
  );
}
