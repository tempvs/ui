import React, { useState } from "react";
import { Link } from "react-router-dom";
import RefreshingImage from "../image/RefreshingImage";
import { DEFAULT_HOURGLASS_IMAGE_SRC } from "./DefaultHourglassImage";
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
export type ReferenceObject = Omit<EntityReference, "start" | "end">;
/** API text fields are trimmed, so offsets must be adjusted at the same boundary. */
export function referencesForTrimmedText(
  value: string,
  references: EntityReference[],
) {
  const offset = value.length - value.trimStart().length;
  const length = value.trim().length;
  return references
    .map((reference) => ({
      ...reference,
      start: reference.start - offset,
      end: reference.end - offset,
    }))
    .filter((reference) => reference.start >= 0 && reference.end <= length);
}
export const referenceLabel = (type: EntityReferenceType) =>
  ({ PROFILE: "Profile", CLUB: "Club", EVENT: "Event", SOURCE: "Source" })[
    type
  ];
export function referencePath(reference: ReferenceObject) {
  const prefix = {
    PROFILE: "/profile/",
    CLUB: "/clubs/",
    EVENT: "/events/",
    SOURCE: "/library/source/",
  }[reference.entityType];
  return prefix + encodeURIComponent(reference.entityId);
}

export function ReferenceThumbnail({
  reference,
}: {
  reference: ReferenceObject;
}) {
  return (
    <RefreshingImage
      image={{
        resourceType: reference.entityType.toLowerCase(),
        resourceId: reference.entityId,
        thumbnailUrl: reference.thumbnailUrl,
      }}
      variant="thumbnail"
      fallbackSrc={DEFAULT_HOURGLASS_IMAGE_SRC}
      alt=""
    />
  );
}

export function EntityReferenceLink({
  reference,
}: {
  reference: ReferenceObject;
}) {
  const [preview, setPreview] = useState(false);
  return (
    <Link
      className="entity-reference"
      to={referencePath(reference)}
      onMouseEnter={() => setPreview(true)}
      onMouseLeave={() => setPreview(false)}
      onFocus={() => setPreview(true)}
      onBlur={() => setPreview(false)}
      aria-label={`@${reference.name}`}
    >
      @{reference.name}
      {preview && (
        <span
          className="entity-reference-preview"
          role="tooltip"
          contentEditable={false}
        >
          <ReferenceThumbnail reference={reference} />
          <span>
            <strong>{reference.name}</strong>
            <small>{referenceLabel(reference.entityType)}</small>
          </span>
        </span>
      )}
    </Link>
  );
}

export function EntityReferenceText({
  content,
  references = [],
  className,
}: {
  content: string;
  references?: EntityReference[];
  className?: string;
}) {
  let cursor = 0;
  const parts: React.ReactNode[] = [];
  [...references]
    .sort((a, b) => a.start - b.start)
    .forEach((reference) => {
      if (
        reference.start < cursor ||
        reference.end > content.length ||
        reference.end <= reference.start ||
        content.slice(reference.start, reference.end) !== `@${reference.name}`
      )
        return;
      parts.push(
        content.slice(cursor, reference.start),
        <EntityReferenceLink key={reference.start} reference={reference} />,
      );
      cursor = reference.end;
    });
  return (
    <span className={className}>
      {parts}
      {content.slice(cursor)}
    </span>
  );
}

export { default as EntityReferenceComposer } from "./ReferenceComposer";
