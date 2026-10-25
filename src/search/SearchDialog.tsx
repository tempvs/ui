import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Badge, Card, Col, Form, Nav, Row } from "react-bootstrap";
import { createPortal } from "react-dom";
import { FaChevronDown, FaSearch } from "react-icons/fa";
import { useIntl } from "react-intl";
import { Link, useLocation } from "react-router-dom";

import { formatAppDate } from "../i18n/appLocale";
import Spinner from "../component/Spinner";
import TextFilterInput from "../component/TextFilterInput";
import HistoricalRangeFilter, {
  type HistoricalYearInput,
} from "../component/HistoricalRangeFilter";
import RefreshingImage from "../image/RefreshingImage";
import {
  findSources,
  getSourceImages,
  LibrarySource,
  LibrarySourceImage,
} from "../library/libraryApi";
import SourceCard from "../library/components/SourceCard";
import {
  getPeriodLabel,
  getTypeLabel,
  PERIODS,
  TYPES,
} from "../library/libraryShared";
import { getProfileAvatar, searchProfiles } from "../profile/profileApi";
import { Avatar, Profile } from "../profile/profileTypes";
import { getErrorMessage } from "../util/errors";
import { Club, listClubs } from "../club/clubApi";
import { listEvents, TempvsEvent } from "../event/eventApi";
import { DEFAULT_HOURGLASS_IMAGE_SRC } from "../component/DefaultHourglassImage";
import {
  appendMapSearchParams,
  overlapsHistoricalRange,
  publicSearchParams,
  rangeFromInputs,
} from "./publicSearchFilterContract";

type SearchTab = "profiles" | "clubs" | "events" | "sources";
type ProfileType = "USER" | "CLUB";

const PAGE_SIZE = 20;
const PROFILE_TYPES: ProfileType[] = ["USER", "CLUB"];
const ChevronDownIcon = FaChevronDown as React.ComponentType<{
  className?: string;
}>;
const SearchIcon = FaSearch as React.ComponentType<{ className?: string }>;

function getProfileTypeLabel(profileType: string | null | undefined) {
  if (profileType === "CLUB") {
    return "Club";
  }

  if (profileType === "USER") {
    return "User";
  }

  return profileType || "";
}

function searchPeriods(
  selectedPeriods: readonly string[],
): Array<string | null> {
  return selectedPeriods.length ? [...selectedPeriods] : [null];
}

function periodKey(period: string | null): string {
  return period || "all";
}

export default function SearchDialog() {
  const intl = useIntl();
  const location = useLocation();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const pagingRef = useRef({
    profilePage: 0,
    clubNextTokens: {} as Record<string, string | undefined>,
    sourceNextTokens: {} as Record<string, string | undefined>,
  });

  const [showPopover, setShowPopover] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<React.CSSProperties>(
    {},
  );
  const [activeTab, setActiveTab] = useState<SearchTab>("profiles");
  const [query, setQuery] = useState("");
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);
  const [selectedProfileTypes, setSelectedProfileTypes] =
    useState<ProfileType[]>(PROFILE_TYPES);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [periodsExpanded, setPeriodsExpanded] = useState(false);
  const [yearsExpanded, setYearsExpanded] = useState(false);
  const [profileTypeExpanded, setProfileTypeExpanded] = useState(false);
  const [from, setFrom] = useState<HistoricalYearInput>({
    year: "",
    era: "AD",
  });
  const [to, setTo] = useState<HistoricalYearInput>({ year: "", era: "AD" });
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileResults, setProfileResults] = useState<Profile[]>([]);
  const [profilePreviewImages, setProfilePreviewImages] = useState<
    Record<string | number, Avatar | null>
  >({});
  const [sourceResults, setSourceResults] = useState<LibrarySource[]>([]);
  const [clubResults, setClubResults] = useState<Club[]>([]);
  const [eventResults, setEventResults] = useState<TempvsEvent[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [sourcePreviewImages, setSourcePreviewImages] = useState<
    Record<string | number, LibrarySourceImage | null>
  >({});
  const profileSearchType =
    selectedProfileTypes.length === 1 ? selectedProfileTypes[0] : null;
  const disablePeriodFilter =
    activeTab === "profiles" && profileSearchType === "USER";
  const range = useMemo(() => rangeFromInputs(from, to), [from, to]);
  const hasYearFilter = Boolean(range.from || range.to);
  const hasPeriodFilter = selectedPeriods.length > 0;

  const handleToggle = <T extends string>(
    value: T,
    selectedValues: readonly T[],
    setter: React.Dispatch<React.SetStateAction<T[]>>,
  ) => {
    setter(
      selectedValues.includes(value)
        ? selectedValues.filter((entry) => entry !== value)
        : [...selectedValues, value],
    );
  };

  const runSearch = useCallback(
    async (tab: SearchTab, append = false) => {
      setLoading(true);
      setError(null);
      if (!append) {
        pagingRef.current = {
          profilePage: 0,
          clubNextTokens: {},
          sourceNextTokens: {},
        };
        setHasMore(false);
      }

      try {
        if (tab === "profiles") {
          if (selectedProfileTypes.length === 0) {
            setProfileResults([]);
            setProfilePreviewImages({});
            setHasMore(false);
            return;
          }
          const profilePeriods =
            profileSearchType === "USER"
              ? [null]
              : searchPeriods(selectedPeriods);
          const resultPages = await Promise.all(
            profilePeriods.map((selectedPeriod) =>
              searchProfiles({
                query,
                period: selectedPeriod,
                type: profileSearchType,
                ...(hasYearFilter && range.from ? { from: range.from } : {}),
                ...(hasYearFilter && range.to ? { to: range.to } : {}),
                page: append ? pagingRef.current.profilePage + 1 : 0,
                size: PAGE_SIZE,
              }),
            ),
          );
          const results = resultPages.flat();

          const content = (Array.isArray(results) ? results : []).filter(
            (item) =>
              selectedProfileTypes.includes(item.type as ProfileType) &&
              (!hasPeriodFilter ||
                selectedPeriods.includes(item.period || "")) &&
              (!hasYearFilter || overlapsHistoricalRange(item, range)),
          );
          setProfileResults((previous) =>
            append
              ? [
                  ...previous,
                  ...content.filter(
                    (item) =>
                      !previous.some(
                        (current) => String(current.id) === String(item.id),
                      ),
                  ),
                ]
              : content,
          );
          pagingRef.current.profilePage = append
            ? pagingRef.current.profilePage + 1
            : 0;
          setHasMore(resultPages.some((page) => page.length === PAGE_SIZE));

          const previewEntries = await Promise.all(
            (Array.isArray(results) ? results : []).map(async (profile) => {
              try {
                const avatar = await getProfileAvatar(profile.id);
                return [profile.id, avatar] as const;
              } catch (previewError) {
                return [profile.id, null] as const;
              }
            }),
          );

          setProfilePreviewImages((previous) =>
            append
              ? { ...previous, ...Object.fromEntries(previewEntries) }
              : Object.fromEntries(previewEntries),
          );
          return;
        }

        if (tab === "clubs") {
          const periodValues = searchPeriods(selectedPeriods);
          const pages = await Promise.all(
            periodValues.map((selectedPeriod) =>
              listClubs(
                query,
                selectedPeriod || "",
                append
                  ? pagingRef.current.clubNextTokens[periodKey(selectedPeriod)]
                  : undefined,
                undefined,
                hasYearFilter ? range.from : null,
                hasYearFilter ? range.to : null,
              ),
            ),
          );
          const content = pages
            .flatMap((page) => page.content || [])
            .filter(
              (item) =>
                (!hasPeriodFilter || selectedPeriods.includes(item.period)) &&
                (!hasYearFilter || overlapsHistoricalRange(item, range)),
            );
          setClubResults((previous) =>
            append
              ? [
                  ...previous,
                  ...content.filter(
                    (item) =>
                      !previous.some(
                        (current) => String(current.id) === String(item.id),
                      ),
                  ),
                ]
              : content,
          );
          pagingRef.current.clubNextTokens = Object.fromEntries(
            periodValues.map((selectedPeriod, index) => [
              periodKey(selectedPeriod),
              pages[index].nextToken,
            ]),
          );
          setHasMore(pages.some((page) => page.hasMore));
          return;
        }

        if (tab === "events") {
          const result = await listEvents();
          const normalized = query.trim().toLocaleLowerCase();
          setEventResults(
            (result.content || []).filter(
              (item) =>
                (!normalized ||
                  `${item.name} ${item.description || ""}`
                    .toLocaleLowerCase()
                    .includes(normalized)) &&
                (!hasPeriodFilter ||
                  item.periods.some((itemPeriod) =>
                    selectedPeriods.includes(itemPeriod),
                  )) &&
                (!hasYearFilter || overlapsHistoricalRange(item, range)),
            ),
          );
          setHasMore(false);
          return;
        }

        const periodValues = searchPeriods(selectedPeriods);
        const resultPages = await Promise.all(
          periodValues.map(async (selectedPeriod) => {
            const result = await findSources({
              query,
              period: selectedPeriod,
              types: selectedTypes,
              ...(hasYearFilter ? range : {}),
              nextToken: append
                ? pagingRef.current.sourceNextTokens[periodKey(selectedPeriod)]
                : undefined,
              size: PAGE_SIZE,
            });
            if (!result.ok) throw new Error("Unable to search sources.");
            return result;
          }),
        );
        const sources = resultPages
          .flatMap((result) => (Array.isArray(result.data) ? result.data : []))
          .filter(
            (source) =>
              !hasPeriodFilter || selectedPeriods.includes(source.period || ""),
          );
        setSourceResults((previous) =>
          append
            ? [
                ...previous,
                ...sources.filter(
                  (source) =>
                    !previous.some(
                      (current) => String(current.id) === String(source.id),
                    ),
                ),
              ]
            : sources,
        );
        pagingRef.current.sourceNextTokens = Object.fromEntries(
          periodValues.map((selectedPeriod, index) => [
            periodKey(selectedPeriod),
            resultPages[index].nextToken || undefined,
          ]),
        );
        setHasMore(resultPages.some((result) => Boolean(result.nextToken)));

        const previewEntries = await Promise.all(
          sources.map(async (source) => {
            try {
              const imageResult = await getSourceImages(source.id);
              if (!imageResult.ok || !Array.isArray(imageResult.data)) {
                return [source.id, null] as const;
              }

              return [source.id, imageResult.data[0] || null] as const;
            } catch (previewError) {
              return [source.id, null] as const;
            }
          }),
        );

        setSourcePreviewImages((previous) =>
          append
            ? { ...previous, ...Object.fromEntries(previewEntries) }
            : Object.fromEntries(previewEntries),
        );
      } catch (searchError) {
        setError(getErrorMessage(searchError));
      } finally {
        setLoading(false);
      }
    },
    [
      selectedPeriods,
      profileSearchType,
      query,
      selectedProfileTypes,
      selectedTypes,
      hasYearFilter,
      hasPeriodFilter,
      range,
    ],
  );

  useEffect(() => {
    if (!showPopover) {
      return;
    }

    setSearched(true);

    const timeoutId = window.setTimeout(() => {
      void runSearch(activeTab);
    }, 120);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    activeTab,
    selectedPeriods,
    selectedProfileTypes,
    query,
    runSearch,
    searched,
    selectedTypes,
    from,
    to,
    showPopover,
  ]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!showPopover || !target || !hasMore || loading) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting))
          void runSearch(activeTab, true);
      },
      { root: null, rootMargin: "160px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [activeTab, hasMore, loading, runSearch, showPopover]);

  useEffect(() => {
    if (!showPopover) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setShowPopover(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowPopover(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showPopover]);

  useEffect(() => {
    setShowPopover(false);
  }, [location.pathname]);

  useLayoutEffect(() => {
    if (!showPopover) {
      setPopoverPosition({});
      return;
    }

    const updatePopoverPosition = () => {
      const shell = rootRef.current;
      if (!shell) return;

      const shellBounds = shell.getBoundingClientRect();
      const top = Math.ceil(shellBounds.bottom + 6);

      if (window.matchMedia("(max-width: 767.98px)").matches) {
        setPopoverPosition({ top: `${top}px` });
        return;
      }

      // The panel lives in a portal so it can sit above the header and page
      // content. Anchor its fixed coordinates to the search field instead of
      // leaving its absolute coordinates relative to document.body.
      const viewportMargin = 16;
      const panelWidth = Math.min(
        popoverRef.current?.getBoundingClientRect().width || 672,
        window.innerWidth - viewportMargin * 2,
      );
      const left = Math.min(
        Math.max(viewportMargin, Math.floor(shellBounds.left)),
        window.innerWidth - panelWidth - viewportMargin,
      );

      setPopoverPosition({ top: `${top}px`, left: `${left}px` });
    };

    updatePopoverPosition();
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);
    window.visualViewport?.addEventListener(
      "resize",
      updatePopoverPosition,
    );

    return () => {
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
      window.visualViewport?.removeEventListener(
        "resize",
        updatePopoverPosition,
      );
    };
  }, [showPopover]);

  const openPopover = () => {
    setShowPopover(true);
    setSearched(true);
  };
  const closePopover = () => setShowPopover(false);

  const handleTriggerChange = (value: string) => {
    setQuery(value);
    setShowPopover(true);
  };
  const mapSearchLink = () => {
    const params = publicSearchParams({
      query,
      period: hasPeriodFilter ? selectedPeriods[0] : "",
      range: hasYearFilter ? range : undefined,
    });
    // Map's `q` is a place-name lookup. Header search is an entity lookup, so
    // project the common textual query into the marker `content` filter.
    params.delete("q");
    if (query.trim()) params.set("content", query.trim());
    if (activeTab === "sources") {
      params.set("types", "SOURCE");
      if (hasPeriodFilter && selectedPeriods.length === 1)
        params.set("sourcePeriod", selectedPeriods[0]);
      appendMapSearchParams(
        params,
        hasYearFilter ? range : { from: null, to: null },
        "source",
      );
    } else if (activeTab === "events") {
      params.set("types", "EVENT");
      if (hasPeriodFilter && selectedPeriods.length === 1)
        params.set("eventPeriod", selectedPeriods[0]);
      appendMapSearchParams(
        params,
        hasYearFilter ? range : { from: null, to: null },
        "event",
      );
    } else if (activeTab === "profiles") {
      params.set("types", "PROFILE");
      if (hasPeriodFilter && selectedPeriods.length === 1)
        params.set("profilePeriod", selectedPeriods[0]);
      if (profileSearchType) params.set("profileType", profileSearchType);
      appendMapSearchParams(
        params,
        hasYearFilter ? range : { from: null, to: null },
        "profile",
      );
    } else {
      params.set("types", "CLUB");
    }
    return `/map?${params.toString()}`;
  };

  return (
    <>
      <div className="header-search-shell" ref={rootRef}>
        <div className="header-search-trigger">
          <button
            type="button"
            className="header-search-icon-button"
            onClick={openPopover}
            aria-label="Open search"
          >
            <SearchIcon />
          </button>
          <TextFilterInput
            value={query}
            onFocus={openPopover}
            onChange={handleTriggerChange}
            className="header-search-input"
            placeholder="Search"
            ariaLabel="Search profiles, clubs, events, and sources"
          />
        </div>

        {showPopover
          ? createPortal(
          <div
            ref={popoverRef}
            className="search-popover header-search-popover"
            role="dialog"
            aria-label="Search"
            style={popoverPosition}
          >
            <Nav
              variant="tabs"
              activeKey={activeTab}
              className="search-tabs mb-3"
            >
              <Nav.Item>
                <Nav.Link
                  eventKey="profiles"
                  onClick={() => setActiveTab("profiles")}
                >
                  Profiles
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link
                  eventKey="clubs"
                  onClick={() => setActiveTab("clubs")}
                >
                  Clubs
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link
                  eventKey="events"
                  onClick={() => setActiveTab("events")}
                >
                  Events
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link
                  eventKey="sources"
                  onClick={() => setActiveTab("sources")}
                >
                  Sources
                </Nav.Link>
              </Nav.Item>
            </Nav>
            <div className="d-flex justify-content-end mb-2">
              <Link
                to={mapSearchLink()}
                onClick={closePopover}
                className="small"
              >
                View these filters on map
              </Link>
            </div>

            <Row className="g-4 mt-1">
              <Col lg={4}>
                <div className="search-sidebar">
                  <button
                    type="button"
                    className="library-source-filter-heading search-filter-disclosure"
                    aria-controls="search-period-controls"
                    aria-expanded={periodsExpanded}
                    onClick={() => setPeriodsExpanded((expanded) => !expanded)}
                  >
                    <span>
                      Periods
                      {hasPeriodFilter ? ` (${selectedPeriods.length})` : ""}
                    </span>
                    <ChevronDownIcon
                      className={`search-filter-disclosure-caret${periodsExpanded ? " is-expanded" : ""}`}
                    />
                  </button>
                  {periodsExpanded && (
                    <div
                      id="search-period-controls"
                      className="search-filter-controls search-filter-options search-period-options d-flex flex-column gap-2"
                    >
                      {PERIODS.map((periodValue) => (
                        <Form.Check
                          key={periodValue}
                          type="checkbox"
                          id={`search-period-${periodValue}`}
                          label={getPeriodLabel(intl, periodValue)}
                          checked={selectedPeriods.includes(periodValue)}
                          disabled={disablePeriodFilter}
                          onChange={() =>
                            handleToggle(
                              periodValue,
                              selectedPeriods,
                              setSelectedPeriods,
                            )
                          }
                        />
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    className="library-source-filter-heading search-filter-disclosure"
                    aria-controls="search-years-controls"
                    aria-expanded={yearsExpanded}
                    onClick={() => setYearsExpanded((expanded) => !expanded)}
                  >
                    <span>Years</span>
                    <ChevronDownIcon
                      className={`search-filter-disclosure-caret${yearsExpanded ? " is-expanded" : ""}`}
                    />
                  </button>
                  {yearsExpanded && (
                    <div
                      id="search-years-controls"
                      className="search-filter-controls"
                    >
                      <HistoricalRangeFilter
                        enabled={hasYearFilter}
                        from={from}
                        to={to}
                        onEnabledChange={() => {}}
                        onFromChange={setFrom}
                        onToChange={setTo}
                        label={null}
                        showToggle={false}
                        stacked
                      />
                    </div>
                  )}

                  {activeTab === "profiles" && (
                    <>
                      <button
                        type="button"
                        className="library-source-filter-heading search-filter-disclosure"
                        aria-controls="search-profile-type-controls"
                        aria-expanded={profileTypeExpanded}
                        onClick={() =>
                          setProfileTypeExpanded((expanded) => !expanded)
                        }
                      >
                        <span>Profile type</span>
                        <ChevronDownIcon
                          className={`search-filter-disclosure-caret${profileTypeExpanded ? " is-expanded" : ""}`}
                        />
                      </button>
                      {profileTypeExpanded && (
                        <div
                          id="search-profile-type-controls"
                          className="search-filter-controls search-filter-options d-flex flex-column gap-2"
                        >
                          <Form.Check
                            type="checkbox"
                            id="profile-type-user"
                            label="User"
                            checked={selectedProfileTypes.includes("USER")}
                            onChange={() =>
                              handleToggle(
                                "USER",
                                selectedProfileTypes,
                                setSelectedProfileTypes,
                              )
                            }
                          />
                          <Form.Check
                            type="checkbox"
                            id="profile-type-club"
                            label="Club"
                            checked={selectedProfileTypes.includes("CLUB")}
                            onChange={() =>
                              handleToggle(
                                "CLUB",
                                selectedProfileTypes,
                                setSelectedProfileTypes,
                              )
                            }
                          />
                        </div>
                      )}
                    </>
                  )}

                  {activeTab === "sources" && (
                    <>
                      <Form.Label className="library-source-filter-heading">
                        Type
                      </Form.Label>
                      <div className="search-filter-options d-flex flex-column gap-2">
                        {TYPES.map((type) => (
                          <Form.Check
                            key={type}
                            type="checkbox"
                            id={`search-type-${type}`}
                            label={getTypeLabel(intl, type)}
                            checked={selectedTypes.includes(type)}
                            onChange={() =>
                              handleToggle(
                                type,
                                selectedTypes,
                                setSelectedTypes,
                              )
                            }
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </Col>

              <Col lg={8}>
                {error && (
                  <div className="tempvs-plain-message text-danger">
                    {error}
                  </div>
                )}
                {loading && <Spinner />}
                {!loading && !searched && (
                  <div className="search-empty-state">Loading results.</div>
                )}

                {!loading && searched && activeTab === "profiles" && (
                  <>
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <h2 className="mb-0 fs-4">Profiles</h2>
                      <div className="text-muted small">
                        {profileResults.length} result(s)
                      </div>
                    </div>
                    {profileResults.length === 0 && (
                      <div className="search-empty-state">
                        No profiles matched the current filters.
                      </div>
                    )}
                    <div className="search-results-grid">
                      {profileResults.map((profile) => {
                        const profileName =
                          [profile.firstName, profile.lastName]
                            .filter(Boolean)
                            .join(" ")
                            .trim() ||
                          profile.alias ||
                          "Unnamed profile";
                        const avatar = profilePreviewImages[profile.id];

                        return (
                          <Card
                            key={String(profile.id)}
                            className="shadow-sm search-profile-card"
                          >
                            <Card.Body className="search-profile-card-body">
                              {avatar &&
                                (avatar.thumbnailUrl || avatar.url) && (
                                  <Link
                                    to={`/profile/${profile.alias || profile.id}`}
                                    className="search-profile-image-link"
                                    onClick={closePopover}
                                  >
                                    <RefreshingImage
                                      image={{
                                        ...avatar,
                                        resourceType: "profile",
                                        resourceId: profile.id,
                                      }}
                                      variant="thumbnail"
                                      alt=""
                                      className="search-profile-image"
                                    />
                                  </Link>
                                )}
                              <div
                                className="text-start flex-grow-1"
                                style={{ minWidth: 0 }}
                              >
                                <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
                                  <Card.Title className="mb-0 fs-5">
                                    <Link
                                      to={`/profile/${profile.alias || profile.id}`}
                                      className="link-dark text-decoration-underline"
                                      onClick={closePopover}
                                    >
                                      {profileName}
                                    </Link>
                                  </Card.Title>
                                  <Badge bg="secondary">
                                    {getProfileTypeLabel(profile.type)}
                                  </Badge>
                                </div>
                                <div className="d-flex flex-wrap gap-2 mb-3">
                                  {profile.period && (
                                    <Badge
                                      bg="light"
                                      text="dark"
                                      className="border"
                                    >
                                      {getPeriodLabel(intl, profile.period)}
                                    </Badge>
                                  )}
                                  {profile.alias && (
                                    <Badge
                                      bg="light"
                                      text="dark"
                                      className="border"
                                    >
                                      @{profile.alias}
                                    </Badge>
                                  )}
                                </div>
                                <div className="search-profile-meta">
                                  {profile.nickName && (
                                    <div>
                                      <strong>Nickname:</strong>{" "}
                                      {profile.nickName}
                                    </div>
                                  )}
                                  {profile.profileEmail && (
                                    <div>
                                      <strong>Email:</strong>{" "}
                                      {profile.profileEmail}
                                    </div>
                                  )}
                                  {profile.location && (
                                    <div>
                                      <strong>Location:</strong>{" "}
                                      {profile.location}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </Card.Body>
                          </Card>
                        );
                      })}
                    </div>
                  </>
                )}

                {!loading && searched && activeTab === "sources" && (
                  <>
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <h2 className="mb-0 fs-4">Sources</h2>
                      <div className="text-muted small">
                        {sourceResults.length} result(s)
                      </div>
                    </div>
                    {sourceResults.length === 0 && (
                      <div className="search-empty-state">
                        No sources matched the current filters.
                      </div>
                    )}
                    <div className="search-results-grid">
                      {sourceResults.map((source) => (
                        <SourceCard
                          key={String(source.id)}
                          source={source}
                          showPeriodBadge
                          firstImage={sourcePreviewImages[source.id] || null}
                        />
                      ))}
                    </div>
                  </>
                )}
                {!loading && searched && activeTab === "clubs" && (
                  <>
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <h2 className="mb-0 fs-4">Clubs</h2>
                      <div className="text-muted small">
                        {clubResults.length} result(s)
                      </div>
                    </div>
                    {clubResults.length === 0 && (
                      <div className="search-empty-state">
                        No clubs matched the current filters.
                      </div>
                    )}
                    <div className="search-results-grid">
                      {clubResults.map((club) => (
                        <Card key={club.id} className="shadow-sm">
                          <Card.Body className="search-profile-card-body">
                            <Link
                              to={`/clubs/${club.alias || club.id}`}
                              className="search-profile-image-link"
                              onClick={closePopover}
                            >
                              <RefreshingImage
                                image={{
                                  resourceType: "club",
                                  resourceId: club.id,
                                  thumbnailUrl: club.photoThumbnailUrl,
                                }}
                                variant="thumbnail"
                                fallbackSrc={DEFAULT_HOURGLASS_IMAGE_SRC}
                                className="search-profile-image"
                                alt=""
                              />
                            </Link>
                            <Card.Title>
                              <Link
                                to={`/clubs/${club.alias || club.id}`}
                                onClick={closePopover}
                              >
                                {club.name}
                              </Link>
                            </Card.Title>
                          </Card.Body>
                        </Card>
                      ))}
                    </div>
                  </>
                )}
                {!loading && searched && activeTab === "events" && (
                  <>
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <h2 className="mb-0 fs-4">Events</h2>
                      <div className="text-muted small">
                        {eventResults.length} result(s)
                      </div>
                    </div>
                    {eventResults.length === 0 && (
                      <div className="search-empty-state">
                        No events matched the current filters.
                      </div>
                    )}
                    <div className="search-results-grid">
                      {eventResults.map((item) => (
                        <Card key={item.id} className="shadow-sm">
                          <Card.Body className="search-profile-card-body">
                            <Link
                              to={`/events/${item.id}`}
                              className="search-profile-image-link"
                              onClick={closePopover}
                            >
                              <RefreshingImage
                                image={{
                                  resourceType: "event",
                                  resourceId: item.id,
                                }}
                                variant="thumbnail"
                                fallbackSrc={DEFAULT_HOURGLASS_IMAGE_SRC}
                                className="search-profile-image"
                                alt=""
                              />
                            </Link>
                            <div>
                              <Card.Title>
                                <Link
                                  to={`/events/${item.id}`}
                                  onClick={closePopover}
                                >
                                  {item.name}
                                </Link>
                              </Card.Title>
                              <small>
                                {item.schedule.startsAt
                                  ? formatAppDate(item.schedule.startsAt)
                                  : "Dates to be announced"}
                              </small>
                            </div>
                          </Card.Body>
                        </Card>
                      ))}
                    </div>
                  </>
                )}
                {hasMore && (
                  <div
                    ref={loadMoreRef}
                    className="search-load-more-sentinel"
                    aria-hidden="true"
                  />
                )}
              </Col>
            </Row>
              </div>,
              document.body,
            )
          : null}
      </div>
    </>
  );
}
