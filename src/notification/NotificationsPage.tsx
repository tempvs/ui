import React, { useEffect, useState } from "react";
import { Alert, Button } from "react-bootstrap";
import { FaTimes } from "react-icons/fa";
import { Link } from "react-router-dom";
import { DEFAULT_HOURGLASS_IMAGE_SRC } from "../component/DefaultHourglassImage";
import TextFilterInput from "../component/TextFilterInput";
import PageLayout from "../component/PageLayout";
import RefreshingImage from "../image/RefreshingImage";
import {
  archiveNotification,
  listNotifications,
  Notification,
  readAllNotifications,
  readNotification,
  NotificationReference,
} from "./notificationApi";
import "./notifications.css";

const RemoveIcon = FaTimes as React.ComponentType<{ "aria-hidden"?: string }>;

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [nextToken, setNextToken] = useState<string>();
  const [filter, setFilter] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [category, setCategory] = useState<
    Notification["category"] | undefined
  >();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async (append = false) => {
    setLoading(true);
    setError("");
    try {
      const page = await listNotifications(
        unreadOnly ? "unread" : "all",
        append ? nextToken : undefined,
        category,
      );
      setItems((current) =>
        append ? [...current, ...page.content] : page.content,
      );
      setNextToken(page.nextToken);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [unreadOnly, category]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = async (notification: Notification) => {
    if (!notification.readAt) {
      try {
        const updated = await readNotification(notification.id);
        setItems((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
      } catch {
        /* Navigation remains available if the read update is delayed. */
      }
    }
  };
  const archive = async (id: string) => {
    try {
      await archiveNotification(id);
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (caught) {
      setError((caught as Error).message);
    }
  };
  const readAll = async () => {
    try {
      await readAllNotifications();
      const readAt = new Date().toISOString();
      setItems((current) =>
        current.map((item) => (item.readAt ? item : { ...item, readAt })),
      );
    } catch (caught) {
      setError((caught as Error).message);
    }
  };
  const query = filter.trim().toLocaleLowerCase();
  const visible = query
    ? items.filter((item) =>
        `${item.title} ${item.summary || ""} ${(item.references || []).map((reference) => reference.label).join(" ")}`
          .toLocaleLowerCase()
          .includes(query),
      )
    : items;

  return (
    <PageLayout
      className="notifications-page"
      header={{
        title: "Notifications",
        rightContent: (
          <div className="notifications-heading-actions">
            <Button
              variant={unreadOnly ? "dark" : "outline-dark"}
              onClick={() => setUnreadOnly((value) => !value)}
            >
              Unread only
            </Button>
            <Button
              variant="outline-secondary"
              disabled={!items.some((item) => !item.readAt)}
              onClick={() => void readAll()}
            >
              Mark all read
            </Button>
          </div>
        ),
      }}
    >
      <div className="notifications-heading">
        <h1>Notifications</h1>
      </div>
      <TextFilterInput
        value={filter}
        onChange={setFilter}
        placeholder="Filter notifications"
        ariaLabel="Filter notifications"
      />
      <nav className="nav nav-tabs mt-3" aria-label="Notification categories">
        {(["ALL", "CLUB", "EVENT", "LIBRARY", "MAP", "PROFILE"] as const).map(
          (tab) => {
            const selected = (tab === "ALL" && !category) || tab === category;
            return (
              <button
                key={tab}
                type="button"
                className={`nav-link${selected ? " active" : ""}`}
                onClick={() => setCategory(tab === "ALL" ? undefined : tab)}
              >
                {tab === "ALL"
                  ? "All"
                  : `${tab[0]}${tab.slice(1).toLowerCase()}`}
              </button>
            );
          },
        )}
      </nav>
      {error && (
        <Alert variant="danger" className="mt-3">
          {error}
        </Alert>
      )}
      {!loading && !error && items.length === 0 && (
        <p className="notification-empty">No notifications yet.</p>
      )}
      <ul className="notification-list">
        {visible.map((item) => (
          <li
            key={item.id}
            className={item.readAt ? "" : "notification-unread"}
          >
            <div className="notification-content">
              <span className="notification-category">{item.category}</span>
              <div className="notification-message">
                <Link
                  to={item.path}
                  className="notification-title"
                  onClick={() => void open(item)}
                >
                  {item.title}
                </Link>
                {(item.references || []).map((reference) => (
                  <NotificationReferenceLink
                    key={`${reference.type}-${reference.id}`}
                    reference={reference}
                    onOpen={() => void open(item)}
                  />
                ))}
              </div>
              {item.summary && <span>{item.summary}</span>}
              <time dateTime={item.createdAt}>
                {new Date(item.createdAt).toLocaleString()}
              </time>
            </div>
            <Button
              variant="link"
              className="notification-archive"
              aria-label="Archive notification"
              onClick={() => void archive(item.id)}
            >
              <RemoveIcon aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
      {loading && <p role="status">Loading notifications…</p>}
      {!loading && nextToken && (
        <Button variant="outline-dark" onClick={() => void load(true)}>
          Load more
        </Button>
      )}
    </PageLayout>
  );
}

function NotificationReferenceLink({
  reference,
  onOpen,
}: {
  reference: NotificationReference;
  onOpen: () => void;
}) {
  return (
    <Link
      to={reference.path}
      className="notification-reference"
      onClick={onOpen}
    >
      <RefreshingImage
        image={{
          resourceType: reference.type.toLocaleLowerCase(),
          resourceId: reference.id,
        }}
        variant="thumbnail"
        fallbackSrc={DEFAULT_HOURGLASS_IMAGE_SRC}
        className="notification-reference-image"
        alt=""
        loading="lazy"
      />
      <span>{reference.label}</span>
    </Link>
  );
}
