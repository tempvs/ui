import React, { useEffect, useState } from 'react';
import { Alert, Button } from 'react-bootstrap';
import { FaPlus, FaUserMinus } from 'react-icons/fa';
import ConfirmationModal from '../component/ConfirmationModal';
import TextFilterInput from '../component/TextFilterInput';
import ProfileList from '../profile/components/ProfileList';
import { fetchProfileById, searchProfiles } from '../profile/profileApi';
import { Profile } from '../profile/profileTypes';
import { addEventAdmin, removeEventAdmin, TempvsEvent } from './eventApi';

const AddIcon = FaPlus as React.ComponentType;
const RemoveIcon = FaUserMinus as React.ComponentType;

type Props = {
  event: TempvsEvent;
  owner: Profile | null;
  canManageAdmins: boolean;
  onChange: (event: TempvsEvent) => void;
};

export default function EventManagers({ event, owner, canManageAdmins, onChange }: Props) {
  const [admins, setAdmins] = useState<Profile[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [removeTarget, setRemoveTarget] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all(event.adminProfileIds.map(id => new Promise<Profile | null>(resolve => {
      fetchProfileById(id, { onSuccess: resolve, onMissing: () => resolve(null), onError: () => resolve(null) });
    }))).then(values => { if (active) setAdmins(values.filter((value): value is Profile => Boolean(value))); });
    return () => { active = false; };
  }, [event.adminProfileIds]);

  useEffect(() => {
    if (!canManageAdmins || query.trim().length < 2) { setResults([]); return; }
    let active = true;
    const timer = window.setTimeout(() => searchProfiles({ query: query.trim(), size: 10 })
      .then(values => { if (active) setResults(values.filter(profile => String(profile.id) !== event.ownerProfileId && !event.adminProfileIds.includes(String(profile.id)))); })
      .catch(() => { if (active) setError('Could not search profiles.'); }), 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [canManageAdmins, event.adminProfileIds, event.ownerProfileId, query]);

  const add = async (profile: Profile) => {
    setBusy(true); setError('');
    try { onChange(await addEventAdmin(event.id, String(profile.id))); setQuery(''); setResults([]); }
    catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!removeTarget) return;
    setBusy(true); setError('');
    try { onChange(await removeEventAdmin(event.id, String(removeTarget.id))); setRemoveTarget(null); }
    catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  };

  return <section className="club-panel event-managers">
    <h2>Owner</h2>
    {owner && <ProfileList profiles={[owner]} />}
    {admins.length > 0 && <><h2>Admins</h2><ProfileList profiles={admins} renderActions={profile => canManageAdmins ? <Button size="sm" variant="outline-danger" aria-label="Remove event admin" title="Remove admin" onClick={() => setRemoveTarget(profile)}><RemoveIcon /></Button> : null} /></>}
    {canManageAdmins && <div className="event-admin-search"><h2>Add admin</h2><TextFilterInput value={query} onChange={setQuery} placeholder="Find a profile" ariaLabel="Find an event admin" disabled={busy} />
      {results.length > 0 && <ProfileList profiles={results} renderActions={profile => <Button size="sm" variant="outline-secondary" aria-label="Add event admin" title="Add admin" disabled={busy} onClick={() => add(profile)}><AddIcon /></Button>} />}
    </div>}
    {error && <Alert variant="danger" className="mt-2">{error}</Alert>}
    <ConfirmationModal show={Boolean(removeTarget)} title="Remove event admin" message="Are you sure you want to remove this event admin?" confirmLabel="Remove" busy={busy} onConfirm={remove} onHide={() => setRemoveTarget(null)} />
  </section>;
}
