import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "react-bootstrap";
import MapReferenceAttachment from "../map/MapReferenceAttachment";
import { formatAppDateTime } from "../i18n/appLocale";
import { getConversation, markConversationRead } from "./chatApi";
import type { ChatConversationDetails } from "./chatTypes";
import { mergeThreadPage, receiptReaders } from "./threadMessages";

export default function ChatThreadMessages({
  conversation,
  profileId,
  setConversation,
  scrollRequest,
  onRead,
}: {
  conversation: ChatConversationDetails;
  profileId: string;
  setConversation: React.Dispatch<
    React.SetStateAction<ChatConversationDetails | null>
  >;
  scrollRequest: number;
  onRead: (count: number) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const latest = useRef(conversation);
  latest.current = conversation;
  const onReadRef = useRef(onRead);
  onReadRef.current = onRead;
  const initialUnread = useRef(conversation.firstUnreadMessageId);
  const initialPositioned = useRef(false);
  const pinned = useRef(false);
  const anchor = useRef<{ id: string; top: number } | null>(null);
  const inFlightPage = useRef(false);
  const readInFlight = useRef(false);
  const [olderLoading, setOlderLoading] = useState(false);
  const [newerLoading, setNewerLoading] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [error, setError] = useState("");
  const id = conversation.id;
  const mounted = useRef(true);
  const previousScrollRequest = useRef(scrollRequest);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const rememberAnchor = () => {
    const container = root.current;
    if (!container) return;
    const top = container.getBoundingClientRect().top;
    const node = Array.from(
      container.querySelectorAll<HTMLElement>("[data-message-id]"),
    ).find((element) => element.getBoundingClientRect().bottom > top);
    anchor.current = node
      ? { id: node.dataset.messageId!, top: node.getBoundingClientRect().top }
      : null;
  };
  const restorePosition = () => {
    const container = root.current;
    if (!container) return;
    if (pinned.current) {
      container.scrollTop = container.scrollHeight;
      return;
    }
    if (anchor.current) {
      const node = Array.from(
        container.querySelectorAll<HTMLElement>("[data-message-id]"),
      ).find((element) => element.dataset.messageId === anchor.current?.id);
      if (node) {
        container.scrollTop +=
          node.getBoundingClientRect().top - anchor.current.top;
        anchor.current.top = node.getBoundingClientRect().top;
      }
    }
  };
  useLayoutEffect(() => {
    if (!root.current) return;
    if (!initialPositioned.current) {
      initialPositioned.current = true;
      const node = Array.from(
        root.current.querySelectorAll<HTMLElement>("[data-message-id]"),
      ).find((element) => element.dataset.messageId === initialUnread.current);
      if (node)
        root.current.scrollTop +=
          node.getBoundingClientRect().top -
          root.current.getBoundingClientRect().top -
          12;
      else {
        root.current.scrollTop = root.current.scrollHeight;
        pinned.current = true;
      }
      rememberAnchor();
    } else restorePosition();
  });
  useEffect(() => {
    if (previousScrollRequest.current === scrollRequest || !root.current)
      return;
    previousScrollRequest.current = scrollRequest;
    pinned.current = true;
    root.current.scrollTop = root.current.scrollHeight;
    setNewCount(0);
  }, [scrollRequest]);
  useEffect(() => {
    if (!content.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(restorePosition);
    observer.observe(content.current);
    return () => observer.disconnect();
  }, []);

  async function loadPage(direction: "older" | "newer") {
    const current = latest.current;
    const token =
      direction === "older"
        ? current.nextToken
        : current.newerToken || current.refreshToken;
    if (!token || inFlightPage.current) return;
    inFlightPage.current = true;
    if (direction === "older") {
      pinned.current = false;
      rememberAnchor();
      setOlderLoading(true);
    } else setNewerLoading(true);
    try {
      const page = await getConversation(id, profileId, token);
      if (!mounted.current || latest.current.id !== id) return;
      setConversation((value) => {
        if (!value || value.id !== id) return value;
        const merged = mergeThreadPage(value, page);
        return direction === "older"
          ? {
              ...merged,
              nextToken: page.nextToken,
              hasMoreMessages: page.hasMoreMessages,
              newerToken: value.newerToken,
              refreshToken: value.refreshToken,
            }
          : merged;
      });
      setError("");
    } catch {
      if (mounted.current) setError("Unable to load messages. Please retry.");
    } finally {
      inFlightPage.current = false;
      if (mounted.current) {
        setOlderLoading(false);
        setNewerLoading(false);
      }
    }
  }

  // Recursive polling never overlaps itself and pauses in background tabs.
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (!active) return;
      if (
        document.visibilityState !== "hidden" &&
        !inFlightPage.current &&
        !latest.current.newerToken
      ) {
        inFlightPage.current = true;
        try {
          const current = latest.current;
          const page = await getConversation(
            id,
            profileId,
            current.refreshToken,
          );
          if (!active) return;
          const known = new Set(current.messages.map((message) => message.id));
          const incoming = page.messages.filter(
            (message) => !known.has(message.id),
          );
          if (!pinned.current && incoming.length)
            setNewCount((count) => count + incoming.length);
          setConversation((value) =>
            value?.id === id ? mergeThreadPage(value, page) : value,
          );
        } catch {
          /* Preserve loaded history and retry on the next poll. */
        } finally {
          inFlightPage.current = false;
        }
      }
      if (active) timer = setTimeout(poll, 4000);
    };
    timer = setTimeout(poll, 4000);
    const wake = () => {
      if (inFlightPage.current) return;
      clearTimeout(timer);
      void poll();
    };
    document.addEventListener("visibilitychange", wake);
    return () => {
      active = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [id, profileId, setConversation]);

  useEffect(() => {
    const container = root.current;
    if (!container) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const acknowledgeVisible = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        if (
          !active ||
          document.visibilityState === "hidden" ||
          !document.hasFocus() ||
          readInFlight.current
        )
          return;
        const rect = container.getBoundingClientRect();
        const visibleTop = Math.max(0, rect.top);
        const visibleBottom = Math.min(window.innerHeight, rect.bottom);
        const nodes = new Map(
          Array.from(
            container.querySelectorAll<HTMLElement>("[data-message-id]"),
          ).map((node) => [node.dataset.messageId, node]),
        );
        const visible = latest.current.messages.filter((message) => {
          if (
            message.senderProfileId === profileId ||
            receiptReaders(message, latest.current).includes(profileId)
          )
            return false;
          const node = nodes.get(message.id);
          if (!node) return false;
          const box = node.getBoundingClientRect();
          return (
            Math.min(box.bottom, visibleBottom) - Math.max(box.top, visibleTop) >=
            Math.min(48, box.height / 2)
          );
        });
        const through = visible[visible.length - 1];
        if (!through) return;
        readInFlight.current = true;
        try {
          const state = await markConversationRead(id, profileId, through);
          if (!active) return;
          setConversation((value) =>
            value?.id === id
              ? {
                  ...value,
                  unreadCount: state.unreadCount,
                  readReceipts: [
                    ...(value.readReceipts || []).filter(
                      (receipt) => receipt.profileId !== profileId,
                    ),
                    { profileId, ...state },
                  ],
                }
              : value,
          );
          onReadRef.current(state.unreadCount);
          window.dispatchEvent(new Event("tempvs:chat-unread-changed"));
        } catch {
          /* Do not show a successful receipt when persistence failed. */
        } finally {
          readInFlight.current = false;
        }
      }, 250);
    };
    container.addEventListener("scroll", acknowledgeVisible, { passive: true });
    window.addEventListener("focus", acknowledgeVisible);
    window.addEventListener("scroll", acknowledgeVisible, { passive: true });
    document.addEventListener("visibilitychange", acknowledgeVisible);
    acknowledgeVisible();
    return () => {
      active = false;
      clearTimeout(timer);
      container.removeEventListener("scroll", acknowledgeVisible);
      window.removeEventListener("focus", acknowledgeVisible);
      window.removeEventListener("scroll", acknowledgeVisible);
      document.removeEventListener("visibilitychange", acknowledgeVisible);
    };
  }, [conversation, id, profileId, setConversation]);

  return (
    <div
      ref={root}
      className="chat-message-list"
      role="log"
      aria-label="Messages"
      onScroll={() => {
        const node = root.current;
        if (!node) return;
        pinned.current =
          node.scrollHeight - node.scrollTop - node.clientHeight < 60 &&
          !latest.current.newerToken;
        if (pinned.current) setNewCount(0);
        rememberAnchor();
        if (node.scrollTop < 60 && latest.current.hasMoreMessages)
          void loadPage("older");
        else if (
          node.scrollHeight - node.scrollTop - node.clientHeight < 80 &&
          latest.current.newerToken
        )
          void loadPage("newer");
      }}
    >
      <div ref={content} className="chat-message-content">
        {conversation.hasMoreMessages && (
          <Button
            variant="link"
            disabled={olderLoading}
            onClick={() => void loadPage("older")}
          >
            {olderLoading ? "Loading…" : "Load older messages"}
          </Button>
        )}
        {error && <p role="alert">{error}</p>}
        {!conversation.messages.length && (
          <p>No messages yet. Send the first one.</p>
        )}
        {conversation.messages.map((message) => {
          const readers = receiptReaders(message, conversation).filter(
            (reader) => reader !== message.senderProfileId,
          );
          const own = message.senderProfileId === profileId;
          const recipientCount = conversation.participants.filter(
            (p) => p.profileId !== message.senderProfileId,
          ).length;
          const names = readers
            .map(
              (reader) =>
                conversation.participants.find((p) => p.profileId === reader)
                  ?.name,
            )
            .filter(Boolean)
            .join(", ");
          const pendingNames = conversation.participants
            .filter(
              (p) =>
                p.profileId !== message.senderProfileId &&
                !readers.includes(p.profileId),
            )
            .map((p) => p.name)
            .join(", ");
          return (
            <React.Fragment key={message.id}>
              {message.id === initialUnread.current && (
                <div className="chat-unread-divider">Unread messages</div>
              )}
              <article
                data-message-id={message.id}
                className={`chat-message-card${own ? " chat-message-card-own" : ""}${message.mapReference ? " chat-message-card-map" : ""}`}
              >
                <div className="chat-message-author">{message.senderName}</div>
                <div className="chat-message-text">{message.text}</div>
                {message.mapReference && (
                  <MapReferenceAttachment
                    reference={message.mapReference}
                    className="chat-map-reference-attachment"
                  />
                )}
                <div className="chat-message-date">
                  {formatAppDateTime(message.createdAt)}
                  {own && (
                    <span
                      className="chat-message-receipt"
                      title={`Read by: ${names || "nobody yet"}. Unread by: ${pendingNames || "nobody"}.`}
                    >
                      {conversation.type === "GROUP"
                        ? `Read by ${readers.length}/${recipientCount}`
                        : readers.length
                          ? "Read"
                          : "Unread"}
                    </span>
                  )}
                </div>
              </article>
            </React.Fragment>
          );
        })}
        {conversation.newerToken && (
          <Button
            variant="link"
            disabled={newerLoading}
            onClick={() => void loadPage("newer")}
          >
            {newerLoading ? "Loading…" : "Load newer messages"}
          </Button>
        )}
        {newCount > 0 && (
          <Button
            className="chat-new-messages"
            onClick={() => {
              pinned.current = true;
              if (root.current)
                root.current.scrollTop = root.current.scrollHeight;
              setNewCount(0);
            }}
          >
            {newCount} new message{newCount === 1 ? "" : "s"} ↓
          </Button>
        )}
      </div>
    </div>
  );
}
