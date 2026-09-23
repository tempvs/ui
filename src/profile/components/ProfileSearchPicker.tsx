import React, { useEffect, useRef, useState } from 'react';
import { Button, Form } from 'react-bootstrap';

import defaultImage from '../../assets/default-image.png';
import RefreshingImage from '../../image/RefreshingImage';
import { PeriodBadge } from '../../util/periods';
import { buildProfileLabel } from '../currentProfile';
import { searchProfiles } from '../profileApi';
import { Profile, ProfileType } from '../profileTypes';

type ProfileSearchPickerProps = {
  type?: ProfileType;
  period?: string | null;
  busy?: boolean;
  onSelect: (profile: Profile) => void;
  selectLabel?: string;
  placeholder?: string;
};

/** A debounced, reusable profile picker for any profile-scoped action. */
export default function ProfileSearchPicker({
  type,
  period,
  busy = false,
  onSelect,
  selectLabel = 'Select',
  placeholder = 'Search profiles by name or alias',
}: ProfileSearchPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    const normalized = query.trim();
    if (!normalized) {
      setResults(null);
      setLoading(false);
      setFailed(false);
      return undefined;
    }
    const id = ++requestId.current;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setFailed(false);
      searchProfiles({ query: normalized, type, period, size: 20 })
        .then(profiles => {
          if (id === requestId.current) setResults(profiles);
        })
        .catch(() => {
          if (id === requestId.current) {
            setResults(null);
            setFailed(true);
          }
        })
        .finally(() => {
          if (id === requestId.current) setLoading(false);
        });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [period, query, type]);

  return <div>
    <Form.Control
      aria-label={placeholder}
      placeholder={placeholder}
      value={query}
      onChange={event => setQuery(event.target.value)}
      autoComplete="off"
    />
    {loading && <p className="text-muted small mt-2 mb-0" role="status">Searching…</p>}
    {failed && <p role="alert" className="mt-2 mb-0">Unable to search profiles. Please try again.</p>}
    {!loading && results?.length === 0 && <p className="mt-2 mb-0">No matching profiles.</p>}
    {results && results.length > 0 && <ul className="club-member-list mb-0">
      {results.map(profile => <li key={profile.id}>
        <span className="club-thumbnail-link">
          <RefreshingImage
            image={{ resourceType: 'profile', resourceId: profile.id }}
            variant="thumbnail"
            fallbackSrc={defaultImage}
            className="club-list-thumbnail"
            alt=""
            loading="lazy"
          />
          <span>{buildProfileLabel(profile)} <PeriodBadge period={profile.period} /></span>
        </span>
        <Button size="sm" variant="outline-secondary" disabled={busy} onClick={() => onSelect(profile)}>{selectLabel}</Button>
      </li>)}
    </ul>}
  </div>;
}
