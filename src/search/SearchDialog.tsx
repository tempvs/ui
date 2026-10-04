import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Card, Col, Form, Nav, Row } from 'react-bootstrap';
import { FaSearch } from 'react-icons/fa';
import { useIntl } from 'react-intl';
import { Link, useLocation } from 'react-router-dom';

import Spinner from '../component/Spinner';
import HistoricalRangeFilter, { type HistoricalYearInput } from '../component/HistoricalRangeFilter';
import RefreshingImage from '../image/RefreshingImage';
import { findSources, getSourceImages, LibrarySource, LibrarySourceImage } from '../library/libraryApi';
import SourceCard from '../library/components/SourceCard';
import {
  CLASSIFICATIONS,
  getClassificationLabel,
  getPeriodLabel,
  getTypeLabel,
  PERIODS,
  TYPES,
} from '../library/libraryShared';
import { getProfileAvatar, searchProfiles } from '../profile/profileApi';
import { Avatar, Profile } from '../profile/profileTypes';
import { getErrorMessage } from '../util/errors';
import { Club, listClubs } from '../club/clubApi';
import { listEvents, TempvsEvent } from '../event/eventApi';
import { DEFAULT_HOURGLASS_IMAGE_SRC } from '../component/DefaultHourglassImage';

type SearchTab = 'profiles' | 'clubs' | 'events' | 'sources';
type ProfileTypeFilter = 'USER' | 'CLUB' | '';

const PAGE_SIZE = 20;
const SearchIcon = FaSearch as React.ComponentType<{ className?: string }>;

function getProfileTypeLabel(profileType: string | null | undefined) {
  if (profileType === 'CLUB') {
    return 'Club';
  }

  if (profileType === 'USER') {
    return 'User';
  }

  return profileType || '';
}

function historicalOrdinal(value?: { year: number; era: 'BC' | 'AD' } | null) {
  if (!value) return null;
  return value.era === 'BC' ? 1 - value.year : value.year;
}

function overlapsRange(
  item: { from?: { year: number; era: 'BC' | 'AD' } | null; to?: { year: number; era: 'BC' | 'AD' } | null },
  from: { year: number; era: 'BC' | 'AD' } | null,
  to: { year: number; era: 'BC' | 'AD' } | null,
) {
  if (!item.from && !item.to) return true;
  const itemFrom = historicalOrdinal(item.from);
  const itemTo = historicalOrdinal(item.to);
  const filterFrom = historicalOrdinal(from);
  const filterTo = historicalOrdinal(to);
  return (itemTo === null || filterFrom === null || itemTo >= filterFrom)
    && (filterTo === null || itemFrom === null || itemFrom <= filterTo);
}

export default function SearchDialog() {
  const intl = useIntl();
  const location = useLocation();
  const rootRef = useRef<HTMLDivElement | null>(null);

  const [showPopover, setShowPopover] = useState(false);
  const [activeTab, setActiveTab] = useState<SearchTab>('profiles');
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState('');
  const [profileType, setProfileType] = useState<ProfileTypeFilter>('');
  const [selectedClassifications, setSelectedClassifications] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [rangeEnabled, setRangeEnabled] = useState(false);
  const [from, setFrom] = useState<HistoricalYearInput>({ year: '', era: 'AD' });
  const [to, setTo] = useState<HistoricalYearInput>({ year: '', era: 'AD' });
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileResults, setProfileResults] = useState<Profile[]>([]);
  const [profilePreviewImages, setProfilePreviewImages] = useState<Record<string | number, Avatar | null>>({});
  const [sourceResults, setSourceResults] = useState<LibrarySource[]>([]);
  const [clubResults, setClubResults] = useState<Club[]>([]);
  const [eventResults, setEventResults] = useState<TempvsEvent[]>([]);
  const [sourcePreviewImages, setSourcePreviewImages] = useState<Record<string | number, LibrarySourceImage | null>>({});
  const disablePeriodFilter = activeTab === 'profiles' && profileType === 'USER';
  const range = useMemo(() => ({
    from: from.year ? { year: Number(from.year), era: from.era } : null,
    to: to.year ? { year: Number(to.year), era: to.era } : null,
  }), [from, to]);

  const handleToggle = (
    value: string,
    selectedValues: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setter(
      selectedValues.includes(value)
        ? selectedValues.filter(entry => entry !== value)
        : [...selectedValues, value]
    );
  };

  const runSearch = useCallback(async (tab: SearchTab) => {
    setLoading(true);
    setError(null);

    try {
      if (tab === 'profiles') {
        const results = await searchProfiles({
          query,
          period: profileType === 'USER' ? null : (period || null),
          type: profileType || null,
          page: 0,
          size: PAGE_SIZE,
        });

        setProfileResults((Array.isArray(results) ? results : []).filter(item => !rangeEnabled || overlapsRange(item, range.from, range.to)));

        const previewEntries = await Promise.all((Array.isArray(results) ? results : []).map(async profile => {
          try {
            const avatar = await getProfileAvatar(profile.id);
            return [profile.id, avatar] as const;
          } catch (previewError) {
            return [profile.id, null] as const;
          }
        }));

        setProfilePreviewImages(Object.fromEntries(previewEntries));
        return;
      }

      if (tab === 'clubs') {
        const result = await listClubs(query, period, undefined, undefined, rangeEnabled ? range.from : null, rangeEnabled ? range.to : null);
        setClubResults((result.content || []).filter(item => !rangeEnabled || overlapsRange(item, range.from, range.to)));
        return;
      }

      if (tab === 'events') {
        const result = await listEvents();
        const normalized = query.trim().toLocaleLowerCase();
        setEventResults((result.content || []).filter(item =>
          (!normalized || `${item.name} ${item.description || ''}`.toLocaleLowerCase().includes(normalized))
          && (!period || item.periods.includes(period as never))
          && (!rangeEnabled || overlapsRange(item, range.from, range.to))));
        return;
      }

      const result = await findSources({
        query,
        period: period || null,
        classifications: selectedClassifications,
        types: selectedTypes,
        ...(rangeEnabled ? range : {}),
        page: 0,
        size: PAGE_SIZE,
      });

      if (!result.ok) {
        throw new Error('Unable to search sources.');
      }

      const sources = Array.isArray(result.data) ? result.data : [];
      setSourceResults(sources);

      const previewEntries = await Promise.all(sources.map(async source => {
        try {
          const imageResult = await getSourceImages(source.id);
          if (!imageResult.ok || !Array.isArray(imageResult.data)) {
            return [source.id, null] as const;
          }

          return [source.id, imageResult.data[0] || null] as const;
        } catch (previewError) {
          return [source.id, null] as const;
        }
      }));

      setSourcePreviewImages(Object.fromEntries(previewEntries));
    } catch (searchError) {
      setError(getErrorMessage(searchError));
    } finally {
      setLoading(false);
    }
  }, [period, profileType, query, selectedClassifications, selectedTypes, rangeEnabled, range]);

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
    period,
    profileType,
    query,
    runSearch,
    searched,
    selectedClassifications,
    selectedTypes,
    rangeEnabled,
    from,
    to,
    showPopover,
  ]);

  useEffect(() => {
    if (!showPopover) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setShowPopover(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowPopover(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showPopover]);

  useEffect(() => {
    setShowPopover(false);
  }, [location.pathname]);

  const openPopover = () => {
    setShowPopover(true);
    setSearched(true);
  };
  const closePopover = () => setShowPopover(false);

  const handleTriggerChange: React.ChangeEventHandler<HTMLInputElement> = event => {
    setQuery(event.target.value);
    setShowPopover(true);
  };

  return (
    <>
      <div className="header-search-shell" ref={rootRef}>
        <div className="header-search-trigger">
          <button type="button" className="header-search-icon-button" onClick={openPopover} aria-label="Open search">
            <SearchIcon />
          </button>
          <Form.Control
            value={query}
            onFocus={openPopover}
            onChange={handleTriggerChange}
            className="header-search-input"
            placeholder="Search"
          />
        </div>

        {showPopover && (
          <div className="search-popover" role="dialog" aria-label="Search">
            <Nav variant="tabs" activeKey={activeTab} className="search-tabs mb-3">
              <Nav.Item>
                <Nav.Link eventKey="profiles" onClick={() => setActiveTab('profiles')}>
                  Profiles
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="clubs" onClick={() => setActiveTab('clubs')}>
                  Clubs
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="events" onClick={() => setActiveTab('events')}>
                  Events
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="sources" onClick={() => setActiveTab('sources')}>
                  Sources
                </Nav.Link>
              </Nav.Item>
            </Nav>

            <Row className="g-4 mt-1">
              <Col lg={4}>
                <div className="search-sidebar">
                  <Form.Label className="library-source-filter-heading">Period</Form.Label>
                  <Form.Select
                    className="mb-4"
                    value={disablePeriodFilter ? '' : period}
                    onChange={event => setPeriod(event.target.value)}
                    disabled={disablePeriodFilter}
                  >
                    <option value="">All periods</option>
                    {PERIODS.map(periodValue => (
                      <option key={periodValue} value={periodValue}>
                        {getPeriodLabel(intl, periodValue)}
                      </option>
                    ))}
                  </Form.Select>
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
                  />

                  {activeTab === 'profiles' && (
                    <>
                      <Form.Label className="library-source-filter-heading">Profile type</Form.Label>
                      <div className="d-flex flex-column gap-2">
                        <Form.Check
                          type="radio"
                          id="profile-type-all"
                          label="All"
                          checked={profileType === ''}
                          onChange={() => setProfileType('')}
                        />
                        <Form.Check
                          type="radio"
                          id="profile-type-user"
                          label="User"
                          checked={profileType === 'USER'}
                          onChange={() => setProfileType('USER')}
                        />
                        <Form.Check
                          type="radio"
                          id="profile-type-club"
                          label="Club"
                          checked={profileType === 'CLUB'}
                          onChange={() => setProfileType('CLUB')}
                        />
                      </div>
                    </>
                  )}

                  {activeTab === 'sources' && (
                    <>
                      <Form.Label className="library-source-filter-heading">Classification</Form.Label>
                      <div className="d-flex flex-column gap-2 mb-4">
                        {CLASSIFICATIONS.map(classification => (
                          <Form.Check
                            key={classification}
                            type="checkbox"
                            id={`search-classification-${classification}`}
                            label={getClassificationLabel(intl, classification)}
                            checked={selectedClassifications.includes(classification)}
                            onChange={() => handleToggle(classification, selectedClassifications, setSelectedClassifications)}
                          />
                        ))}
                      </div>

                      <Form.Label className="library-source-filter-heading">Type</Form.Label>
                      <div className="d-flex flex-column gap-2">
                        {TYPES.map(type => (
                          <Form.Check
                            key={type}
                            type="checkbox"
                            id={`search-type-${type}`}
                            label={getTypeLabel(intl, type)}
                            checked={selectedTypes.includes(type)}
                            onChange={() => handleToggle(type, selectedTypes, setSelectedTypes)}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </Col>

              <Col lg={8}>
                {error && <div className="tempvs-plain-message text-danger">{error}</div>}
                {loading && <Spinner />}
                {!loading && !searched && (
                  <div className="search-empty-state">Loading results.</div>
                )}

                {!loading && searched && activeTab === 'profiles' && (
                  <>
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <h2 className="mb-0 fs-4">Profiles</h2>
                      <div className="text-muted small">{profileResults.length} result(s)</div>
                    </div>
                    {profileResults.length === 0 && (
                      <div className="search-empty-state">No profiles matched the current filters.</div>
                    )}
                    <div className="search-results-grid">
                      {profileResults.map(profile => {
                        const profileName = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim() || profile.alias || 'Unnamed profile';
                        const avatar = profilePreviewImages[profile.id];

                        return (
                          <Card key={String(profile.id)} className="shadow-sm search-profile-card">
                            <Card.Body className="search-profile-card-body">
                              {avatar && (avatar.thumbnailUrl || avatar.url) && (
                                <Link to={`/profile/${profile.alias || profile.id}`} className="search-profile-image-link" onClick={closePopover}>
                                  <RefreshingImage
                                    image={{ ...avatar, resourceType: 'profile', resourceId: profile.id }}
                                    variant="thumbnail"
                                    alt=""
                                    className="search-profile-image"
                                  />
                                </Link>
                              )}
                              <div className="text-start flex-grow-1" style={{ minWidth: 0 }}>
                                <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
                                  <Card.Title className="mb-0 fs-5">
                                    <Link to={`/profile/${profile.alias || profile.id}`} className="link-dark text-decoration-underline" onClick={closePopover}>
                                      {profileName}
                                    </Link>
                                  </Card.Title>
                                  <Badge bg="secondary">{getProfileTypeLabel(profile.type)}</Badge>
                                </div>
                                <div className="d-flex flex-wrap gap-2 mb-3">
                                  {profile.period && (
                                    <Badge bg="light" text="dark" className="border">
                                      {getPeriodLabel(intl, profile.period)}
                                    </Badge>
                                  )}
                                  {profile.alias && <Badge bg="light" text="dark" className="border">@{profile.alias}</Badge>}
                                </div>
                                <div className="search-profile-meta">
                                  {profile.nickName && <div><strong>Nickname:</strong> {profile.nickName}</div>}
                                  {profile.profileEmail && <div><strong>Email:</strong> {profile.profileEmail}</div>}
                                  {profile.location && <div><strong>Location:</strong> {profile.location}</div>}
                                </div>
                              </div>
                            </Card.Body>
                          </Card>
                        );
                      })}
                    </div>
                  </>
                )}

                {!loading && searched && activeTab === 'sources' && (
                  <>
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <h2 className="mb-0 fs-4">Sources</h2>
                      <div className="text-muted small">{sourceResults.length} result(s)</div>
                    </div>
                    {sourceResults.length === 0 && (
                      <div className="search-empty-state">No sources matched the current filters.</div>
                    )}
                    <div className="search-results-grid">
                      {sourceResults.map(source => (
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
                {!loading && searched && activeTab === 'clubs' && (
                  <><div className="d-flex align-items-center justify-content-between mb-3"><h2 className="mb-0 fs-4">Clubs</h2><div className="text-muted small">{clubResults.length} result(s)</div></div>
                    {clubResults.length === 0 && <div className="search-empty-state">No clubs matched the current filters.</div>}
                    <div className="search-results-grid">{clubResults.map(club => <Card key={club.id} className="shadow-sm"><Card.Body className="search-profile-card-body"><Link to={`/clubs/${club.alias || club.id}`} onClick={closePopover}><RefreshingImage image={{ resourceType: 'club', resourceId: club.id, thumbnailUrl: club.photoThumbnailUrl }} variant="thumbnail" fallbackSrc={DEFAULT_HOURGLASS_IMAGE_SRC} className="search-profile-image" alt="" /></Link><Card.Title><Link to={`/clubs/${club.alias || club.id}`} onClick={closePopover}>{club.name}</Link></Card.Title></Card.Body></Card>)}</div>
                  </>
                )}
                {!loading && searched && activeTab === 'events' && (
                  <><div className="d-flex align-items-center justify-content-between mb-3"><h2 className="mb-0 fs-4">Events</h2><div className="text-muted small">{eventResults.length} result(s)</div></div>
                    {eventResults.length === 0 && <div className="search-empty-state">No events matched the current filters.</div>}
                    <div className="search-results-grid">{eventResults.map(item => <Card key={item.id} className="shadow-sm"><Card.Body className="search-profile-card-body"><Link to={`/events/${item.id}`} onClick={closePopover}><RefreshingImage image={{ resourceType: 'event', resourceId: item.id }} variant="thumbnail" fallbackSrc={DEFAULT_HOURGLASS_IMAGE_SRC} className="search-profile-image" alt="" /></Link><div><Card.Title><Link to={`/events/${item.id}`} onClick={closePopover}>{item.name}</Link></Card.Title><small>{new Date(item.schedule.startsAt).toLocaleDateString()}</small></div></Card.Body></Card>)}</div>
                  </>
                )}
              </Col>
            </Row>
          </div>
        )}
      </div>
    </>
  );
}
