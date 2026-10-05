import React, { useEffect, useState } from 'react';
import { Alert, Button, Container } from 'react-bootstrap';
import { FaTimes } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import TextFilterInput from '../component/TextFilterInput';
import SectionHeaderBar from '../component/SectionHeaderBar';
import {
  archiveNotification,
  listNotifications,
  Notification,
  readAllNotifications,
  readNotification,
} from './notificationApi';
import './notifications.css';

const RemoveIcon = FaTimes as React.ComponentType<{ 'aria-hidden'?: string }>;

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [nextToken, setNextToken] = useState<string>();
  const [filter, setFilter] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (append = false) => {
    setLoading(true); setError('');
    try {
      const page = await listNotifications(unreadOnly ? 'unread' : 'all', append ? nextToken : undefined);
      setItems(current => append ? [...current, ...page.content] : page.content);
      setNextToken(page.nextToken);
    } catch (caught) { setError((caught as Error).message); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [unreadOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = async (notification: Notification) => {
    if (!notification.readAt) {
      try {
        const updated = await readNotification(notification.id);
        setItems(current => current.map(item => item.id === updated.id ? updated : item));
      } catch { /* Navigation remains available if the read update is delayed. */ }
    }
  };
  const archive = async (id: string) => {
    try { await archiveNotification(id); setItems(current => current.filter(item => item.id !== id)); }
    catch (caught) { setError((caught as Error).message); }
  };
  const readAll = async () => {
    try {
      await readAllNotifications();
      const readAt = new Date().toISOString();
      setItems(current => current.map(item => item.readAt ? item : { ...item, readAt }));
    } catch (caught) { setError((caught as Error).message); }
  };
  const query = filter.trim().toLocaleLowerCase();
  const visible = query ? items.filter(item => `${item.title} ${item.summary || ''}`.toLocaleLowerCase().includes(query)) : items;

  return <Container className="notifications-page">
    <SectionHeaderBar title="Notifications" rightContent={<div className="notifications-heading-actions">
      <Button variant={unreadOnly ? 'dark' : 'outline-dark'} onClick={() => setUnreadOnly(value => !value)}>Unread only</Button>
      <Button variant="outline-secondary" disabled={!items.some(item => !item.readAt)} onClick={() => void readAll()}>Mark all read</Button>
    </div>} />
    <div className="notifications-heading">
      <h1>Notifications</h1>
    </div>
    <TextFilterInput value={filter} onChange={setFilter} placeholder="Filter notifications" ariaLabel="Filter notifications" />
    {error && <Alert variant="danger" className="mt-3">{error}</Alert>}
    {!loading && !error && items.length === 0 && <p className="notification-empty">No notifications yet.</p>}
    <ul className="notification-list">
      {visible.map(item => <li key={item.id} className={item.readAt ? '' : 'notification-unread'}>
        <Link to={item.path} onClick={() => void open(item)}>
          <span className="notification-category">{item.category}</span>
          <strong>{item.title}</strong>
          {item.summary && <span>{item.summary}</span>}
          <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
        </Link>
        <Button variant="link" className="notification-archive" aria-label="Archive notification" onClick={() => void archive(item.id)}><RemoveIcon aria-hidden="true" /></Button>
      </li>)}
    </ul>
    {loading && <p role="status">Loading notifications…</p>}
    {!loading && nextToken && <Button variant="outline-dark" onClick={() => void load(true)}>Load more</Button>}
  </Container>;
}
