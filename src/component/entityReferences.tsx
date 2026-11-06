import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";

import { listClubs } from "../club/clubApi";
import { listEvents } from "../event/eventApi";
import { findSources } from "../library/libraryApi";
import { getProfileAvatar, searchProfiles } from "../profile/profileApi";

import "./entityReferences.css";

export type EntityReferenceType = "PROFILE" | "CLUB" | "EVENT" | "SOURCE";
export type EntityReference = {
  entityType: EntityReferenceType;
  entityId: string;
  start: number;
  end: number;
  name: string;
  thumbnailUrl?: string;
};

type Candidate = Omit<EntityReference, "start" | "end">;

const pathFor = (
  reference: Pick<EntityReference, "entityType" | "entityId">,
) => {
  const id = encodeURIComponent(reference.entityId);
  switch (reference.entityType) {
    case "PROFILE":
      return `/profile/${id}`;
    case "CLUB":
      return `/clubs/${id}`;
    case "EVENT":
      return `/events/${id}`;
    case "SOURCE":
      return `/library/source/${id}`;
  }
};

const labelFor = (type: EntityReferenceType) =>
  ({ PROFILE: "Profile", CLUB: "Club", EVENT: "Event", SOURCE: "Source" })[
    type
  ];

/** Keeps UUID references aligned as ordinary text is inserted or removed. */
export function reconcileEntityReferences(
  previous: string,
  next: string,
  references: EntityReference[],
): EntityReference[] {
  let start = 0;
  while (
    start < previous.length &&
    start < next.length &&
    previous[start] === next[start]
  )
    start += 1;
  let previousEnd = previous.length;
  let nextEnd = next.length;
  while (
    previousEnd > start &&
    nextEnd > start &&
    previous[previousEnd - 1] === next[nextEnd - 1]
  ) {
    previousEnd -= 1;
    nextEnd -= 1;
  }
  const delta = nextEnd - start - (previousEnd - start);
  return references.flatMap((reference) => {
    if (reference.end <= start) return [reference];
    if (reference.start >= previousEnd)
      return [
        {
          ...reference,
          start: reference.start + delta,
          end: reference.end + delta,
        },
      ];
    return [];
  });
}

export function EntityReferenceText({
  content,
  references,
  className,
  inEditor = false,
}: {
  content: string;
  references?: EntityReference[];
  className?: string;
  inEditor?: boolean;
}) {
  const [resolvedThumbnails, setResolvedThumbnails] = useState<
    Record<string, string>
  >({});
  const attemptedThumbnails = useRef(new Set<string>());
  useEffect(() => {
    const missing = (references || []).filter(
      (reference) =>
        reference.entityType === "PROFILE" &&
        !reference.thumbnailUrl &&
        !resolvedThumbnails[reference.entityId] &&
        !attemptedThumbnails.current.has(reference.entityId),
    );
    if (!missing.length) return;
    missing.forEach((reference) =>
      attemptedThumbnails.current.add(reference.entityId),
    );
    let active = true;
    Promise.all(
      missing.map(async (reference) => {
        const avatar = await getProfileAvatar(reference.entityId);
        return [
          reference.entityId,
          avatar?.thumbnailUrl || avatar?.url,
        ] as const;
      }),
    )
      .then((items) => {
        if (active)
          setResolvedThumbnails((current) => ({
            ...current,
            ...Object.fromEntries(
              items.filter(([, url]) => Boolean(url)) as Array<
                [string, string]
              >,
            ),
          }));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [references, resolvedThumbnails]);
  const valid = (references || [])
    .filter(
      (reference) =>
        reference.start >= 0 &&
        reference.end > reference.start &&
        reference.end <= content.length &&
        content.slice(reference.start, reference.end) === `@${reference.name}`,
    )
    .sort((a, b) => a.start - b.start);
  let cursor = 0;
  return (
    <span className={className}>
      {valid.map((reference) => {
        const text = content.slice(cursor, reference.start);
        cursor = reference.end;
        return (
          <React.Fragment
            key={`${reference.entityType}:${reference.entityId}:${reference.start}`}
          >
            {text}
            <Link
              className="entity-reference"
              to={pathFor(reference)}
              contentEditable={inEditor ? false : undefined}
              onMouseDown={
                inEditor ? (event) => event.stopPropagation() : undefined
              }
            >
              @{reference.name}
              <span className="entity-reference-preview" role="tooltip">
                {reference.thumbnailUrl ||
                resolvedThumbnails[reference.entityId] ? (
                  <img
                    src={
                      reference.thumbnailUrl ||
                      resolvedThumbnails[reference.entityId]
                    }
                    alt=""
                  />
                ) : (
                  <span className="entity-reference-placeholder" aria-hidden />
                )}
                <span>
                  <strong>{reference.name}</strong>
                  <small>{labelFor(reference.entityType)}</small>
                </span>
              </span>
            </Link>
          </React.Fragment>
        );
      })}
      {content.slice(cursor)}
    </span>
  );
}

function editorText(root: Node): string {
  if (root.nodeType === Node.TEXT_NODE)
    return (root.textContent || "").replace(/\u200b/g, "");
  if (
    root.nodeType !== Node.ELEMENT_NODE &&
    root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE
  )
    return "";
  const element = root as Element;
  if (element.classList?.contains("entity-reference-preview")) return "";
  if (element.tagName === "BR") return "\n";
  return Array.from(root.childNodes).map(editorText).join("");
}

function caretOffset(root: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return editorText(root).length;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.endContainer)) return editorText(root).length;
  const before = range.cloneRange();
  before.selectNodeContents(root);
  before.setEnd(range.endContainer, range.endOffset);
  return editorText(before.cloneContents()).length;
}

function setCaret(root: HTMLElement, offset: number) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.parentElement?.closest(".entity-reference-preview")
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT;
    },
  });
  let remaining = offset;
  let node = walker.nextNode();
  while (node) {
    const length = node.textContent?.length || 0;
    if (remaining <= length) {
      const range = document.createRange();
      const reference = node.parentElement?.closest(".entity-reference");
      if (reference) {
        const caret = reference.nextElementSibling;
        if (caret?.classList.contains("entity-reference-caret")) {
          range.selectNodeContents(caret);
          range.collapse(false);
        } else range.setStartAfter(reference);
      } else range.setStart(node, remaining);
      range.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
    }
    remaining -= length;
    node = walker.nextNode();
  }
}

function referenceSignature(references: EntityReference[]) {
  return references
    .map(
      (reference) =>
        `${reference.entityType}:${reference.entityId}:${reference.name}:${reference.thumbnailUrl || ""}`,
    )
    .join("|");
}

function renderEditor(
  root: HTMLDivElement,
  content: string,
  references: EntityReference[],
) {
  const valid = references
    .filter(
      (reference) =>
        reference.start >= 0 &&
        reference.end <= content.length &&
        content.slice(reference.start, reference.end) === `@${reference.name}`,
    )
    .sort((left, right) => left.start - right.start);
  root.replaceChildren();
  let cursor = 0;
  const appendText = (text: string) => {
    if (text) root.append(document.createTextNode(text));
  };
  valid.forEach((reference) => {
    appendText(content.slice(cursor, reference.start));
    const link = document.createElement("a");
    link.className = "entity-reference";
    link.href = pathFor(reference);
    link.contentEditable = "false";
    link.dataset.entityReference = `${reference.entityType}:${reference.entityId}`;
    link.append(document.createTextNode(`@${reference.name}`));
    const preview = document.createElement("span");
    preview.className = "entity-reference-preview";
    if (reference.thumbnailUrl) {
      const image = document.createElement("img");
      image.src = reference.thumbnailUrl;
      image.alt = "";
      preview.append(image);
    } else {
      const placeholder = document.createElement("span");
      placeholder.className = "entity-reference-placeholder";
      preview.append(placeholder);
    }
    const details = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = reference.name;
    const type = document.createElement("small");
    type.textContent = labelFor(reference.entityType);
    details.append(name, type);
    preview.append(details);
    link.append(preview);
    root.append(link);
    // Browsers cannot reliably place an editable caret immediately after a
    // contenteditable=false link without a real editable node to land in.
    const caret = document.createElement("span");
    caret.className = "entity-reference-caret";
    caret.append(document.createTextNode("\u200b"));
    root.append(caret);
    cursor = reference.end;
  });
  appendText(content.slice(cursor));
  root.dataset.referenceSignature = referenceSignature(valid);
}

export function EntityReferenceComposer({
  value,
  references,
  onChange,
  className,
  placeholder,
  disabled,
  maxLength,
  onKeyDown,
  "aria-label": ariaLabel,
}: {
  value: string;
  references: EntityReference[];
  onChange: (value: string, references: EntityReference[]) => void;
} & Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange"
>) {
  const input = useRef<HTMLDivElement | null>(null);
  const pendingCaret = useRef<number | null>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [triggerStart, setTriggerStart] = useState(0);
  const [results, setResults] = useState<Candidate[]>([]);
  useLayoutEffect(() => {
    if (input.current) {
      const root = input.current;
      if (
        editorText(root) !== value ||
        root.dataset.referenceSignature !== referenceSignature(references)
      )
        renderEditor(root, value, references);
      if (pendingCaret.current !== null) {
        setCaret(root, pendingCaret.current);
        pendingCaret.current = null;
      }
    }
  }, [value, references]);
  useEffect(() => {
    if (query === null) return;
    let active = true;
    const term = query.trim();
    if (!term) {
      setResults([]);
      return;
    }
    const contains = (value: string | null | undefined) =>
      value?.toLocaleLowerCase().includes(term.toLocaleLowerCase());
    Promise.all([
      searchProfiles({ query: term, size: 8 }).then((items) =>
        Promise.all(
          items.map(async (item) => {
            const profileAvatar = item.avatarUrl
              ? null
              : await getProfileAvatar(item.id);
            const avatar =
              item.avatarUrl ||
              profileAvatar?.thumbnailUrl ||
              profileAvatar?.url;
            return {
              entityType: "PROFILE" as const,
              entityId: String(item.id),
              name:
                [item.firstName, item.lastName].filter(Boolean).join(" ") ||
                item.alias ||
                "Unnamed profile",
              thumbnailUrl: avatar || undefined,
            };
          }),
        ),
      ),
      listClubs(term).then((page) =>
        page.content.map((item) => ({
          entityType: "CLUB" as const,
          entityId: String(item.id),
          name: item.name,
          thumbnailUrl: item.photoThumbnailUrl || item.photoUrl || undefined,
        })),
      ),
      listEvents().then((page) =>
        page.content
          .filter((item) => contains(item.name))
          .slice(0, 8)
          .map((item) => ({
            entityType: "EVENT" as const,
            entityId: item.id,
            name: item.name,
            thumbnailUrl: item.image?.thumbnailUrl || item.image?.url,
          })),
      ),
      findSources({ query: term, size: 8 }).then((page) =>
        page.data.map((item) => ({
          entityType: "SOURCE" as const,
          entityId: item.id,
          name: item.name || "Untitled source",
        })),
      ),
    ])
      .then((groups) => {
        if (active) setResults(groups.flat());
      })
      .catch(() => {
        if (active) setResults([]);
      });
    return () => {
      active = false;
    };
  }, [query]);
  const select = (candidate: Candidate) => {
    const before = value.slice(0, triggerStart);
    const inserted = `@${candidate.name}`;
    const next = `${before}${inserted}${value.slice(triggerStart + (query?.length || 0) + 1)}`;
    const nextReferences = reconcileEntityReferences(
      value,
      next,
      references,
    ).concat({
      ...candidate,
      start: before.length,
      end: before.length + inserted.length,
    });
    pendingCaret.current = before.length + inserted.length;
    onChange(next, nextReferences);
    setQuery(null);
    requestAnimationFrame(() => input.current?.focus());
  };
  const grouped = useMemo(
    () =>
      (["PROFILE", "CLUB", "EVENT", "SOURCE"] as EntityReferenceType[])
        .map(
          (type) =>
            [type, results.filter((item) => item.entityType === type)] as const,
        )
        .filter(([, items]) => items.length),
    [results],
  );
  return (
    <div className="entity-reference-composer">
      <div
        ref={input}
        className={`entity-reference-composer-input ${className || ""}`.trim()}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-label={ariaLabel}
        aria-multiline="true"
        aria-placeholder={placeholder}
        data-placeholder={placeholder}
        onInput={(event) => {
          // `innerText` matches what the user can edit (and is also what jsdom
          // updates when tests simulate a rich-editor input event). The preview
          // is display:none except while a reference is being inspected.
          const next = event.currentTarget.innerText
            .replace(/\u200b/g, "")
            .replace(/\n$/, "");
          if (maxLength && next.length > maxLength) return;
          const cursor = caretOffset(event.currentTarget);
          pendingCaret.current = cursor;
          onChange(next, reconcileEntityReferences(value, next, references));
          const prefix = next.slice(0, cursor);
          const match = /(^|\s)@([^\s@]*)$/.exec(prefix);
          if (match) {
            setTriggerStart(cursor - match[2].length - 1);
            setQuery(match[2]);
          } else setQuery(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setQuery(null);
          onKeyDown?.(
            event as unknown as React.KeyboardEvent<HTMLTextAreaElement>,
          );
        }}
      ></div>
      {query !== null && (
        <div
          className="entity-reference-menu"
          role="listbox"
          aria-label="Reference search results"
        >
          {grouped.length ? (
            grouped.map(([type, items]) => (
              <section key={type}>
                <h3>{labelFor(type)}s</h3>
                {items.map((item) => (
                  <button
                    key={`${item.entityType}:${item.entityId}`}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => select(item)}
                  >
                    <span className="entity-reference-menu-thumb">
                      {item.thumbnailUrl ? (
                        <img src={item.thumbnailUrl} alt="" />
                      ) : null}
                    </span>
                    <span>
                      {item.name}
                      <small>{labelFor(item.entityType)}</small>
                    </span>
                  </button>
                ))}
              </section>
            ))
          ) : (
            <p>Keep typing to search profiles, clubs, events, and sources.</p>
          )}
        </div>
      )}
    </div>
  );
}
