import React, { useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { useIntl } from 'react-intl';
import { searchProfiles } from '../profile/profileApi';
import { Profile } from '../profile/profileTypes';
import { buildProfileLabel } from '../profile/currentProfile';
import { PeriodBadge } from '../util/periods';

export default function ProfilePicker({ type, busy, onSelect }: { type: 'USER' | 'CLUB'; busy: boolean; onSelect: (profile: Profile) => void }) {
  const intl = useIntl();
  const t = (id: string, defaultMessage: string) => intl.formatMessage({ id: `clubs.${id}`, defaultMessage });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const search = async (event: React.FormEvent) => {
    event.preventDefault(); setLoading(true); setFailed(false); setResults(null);
    try { setResults(await searchProfiles({ query, type, size: 20 })); }
    catch { setFailed(true); }
    finally { setLoading(false); }
  };
  return <div>
    <Form className="club-actions" onSubmit={search}>
      <Form.Control aria-label={t('searchProfiles', 'Search profiles by name or alias')} placeholder={t('searchProfiles', 'Search profiles by name or alias')} value={query} onChange={e => setQuery(e.target.value)} />
      <Button type="submit" variant="outline-secondary" disabled={loading || busy}>{t('search', 'Search')}</Button>
    </Form>
    {failed && <p role="alert">{t('searchFailed', 'Unable to search profiles. Please try again.')}</p>}
    {results?.length === 0 && <p className="mt-3">{t('noProfiles', 'No matching profiles.')}</p>}
    {results && results.length > 0 && <ul className="club-member-list">
      {results.map(profile => <li key={profile.id}>
        <span>{buildProfileLabel(profile)} <PeriodBadge period={profile.period} /></span>
        <Button size="sm" variant="outline-secondary" disabled={busy} onClick={() => onSelect(profile)}>{t('add', 'Add')}</Button>
      </li>)}
    </ul>}
  </div>;
}
