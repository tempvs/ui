import type { ReactNode } from "react";

import {
  type HistoricalYear,
  type LibrarySourceImage,
  type SourceImageOperation,
  type SourceChangesetSnapshot,
} from "../libraryApi";

type Props = {
  base: SourceChangesetSnapshot;
  proposed: SourceChangesetSnapshot;
  compact?: boolean;
  kind?: "UPDATE" | "DELETE";
  imageOperations?: SourceImageOperation[];
  imagePreviews?: {
    published?: LibrarySourceImage[];
    staged?: LibrarySourceImage[];
  };
};

function formatYear(value: HistoricalYear | null | undefined) {
  if (!value) return "—";
  return `${value.year}${value.era === "BC" || value.year < 100 ? ` ${value.era}` : ""}`;
}

function formatRange(value: {
  from: HistoricalYear | null;
  to: HistoricalYear | null;
}) {
  return `${formatYear(value.from)} – ${formatYear(value.to)}`;
}

function formatValue(field: string, value: unknown): ReactNode {
  if (field === "years")
    return formatRange(
      value as { from: HistoricalYear | null; to: HistoricalYear | null },
    );
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

const fieldLabels: Record<string, string> = {
  name: "Name",
  description: "Description",
  period: "Period",
  classification: "Classification",
  type: "Type",
  years: "Years",
};

function ImageThumbnail({
  image,
  label,
  tone = "current",
}: {
  image: LibrarySourceImage | undefined;
  label: string;
  tone?: "before" | "after" | "current";
}) {
  const url = image?.thumbnailUrl || image?.url;
  return (
    <div
      className={`source-changeset-image-thumbnail source-changeset-image-thumbnail-${tone}`}
    >
      <div className="source-changeset-image-thumbnail-label">{label}</div>
      {url ? (
        <img
          src={url}
          alt={`${label}: ${image?.description || image?.fileName || "source image"}`}
        />
      ) : (
        <div className="source-changeset-image-thumbnail-empty">
          {image?.fileName || "Image preview unavailable"}
        </div>
      )}
      {image?.fileName && (
        <div className="source-changeset-image-thumbnail-name">
          {image.fileName}
        </div>
      )}
    </div>
  );
}

function ImageOperationDiff({
  operation,
  publishedById,
  stagedById,
}: {
  operation: SourceImageOperation;
  publishedById: Map<string, LibrarySourceImage>;
  stagedById: Map<string, LibrarySourceImage>;
}) {
  if (operation.kind === "ADD") {
    return (
      <div className="source-changeset-image-change">
        <div className="source-changeset-image-change-title">Add image</div>
        <ImageThumbnail
          image={stagedById.get(operation.stagedImageId)}
          label="New image"
          tone="after"
        />
      </div>
    );
  }
  if (operation.kind === "REMOVE") {
    return (
      <div className="source-changeset-image-change">
        <div className="source-changeset-image-change-title">Remove image</div>
        <ImageThumbnail
          image={publishedById.get(operation.imageId)}
          label="Removed image"
          tone="before"
        />
      </div>
    );
  }
  if (operation.kind === "REPLACE") {
    return (
      <div className="source-changeset-image-change">
        <div className="source-changeset-image-change-title">Replace image</div>
        <div className="source-changeset-image-pair">
          <ImageThumbnail
            image={publishedById.get(operation.imageId)}
            label="Current image"
            tone="before"
          />
          <ImageThumbnail
            image={stagedById.get(operation.stagedImageId)}
            label="Replacement"
            tone="after"
          />
        </div>
      </div>
    );
  }
  const image = publishedById.get(operation.imageId);
  return (
    <div className="source-changeset-image-change">
      <div className="source-changeset-image-change-title">
        Change image description
      </div>
      <div className="source-changeset-image-description-change">
        <ImageThumbnail image={image} label="Image" />
        <div className="source-changeset-diff-values">
          <span className="source-changeset-diff-before">
            <span aria-hidden="true">− </span>
            {formatValue("description", image?.description || null)}
          </span>
          <span className="source-changeset-diff-after">
            <span aria-hidden="true">+ </span>
            {formatValue("description", operation.description)}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Shared field-level renderer for the author preview and reviewer detail. */
export default function SourceChangesetDiff({
  base,
  proposed,
  compact = false,
  kind = "UPDATE",
  imageOperations = [],
  imagePreviews,
}: Props) {
  if (kind === "DELETE") {
    return (
      <div className="source-changeset-diff-row">
        <div className="fw-semibold small text-uppercase text-muted">
          Source
        </div>
        <div className="source-changeset-diff-before">
          This proposal deletes the source and its images after review approval.
        </div>
      </div>
    );
  }
  const values = {
    name: [base.name, proposed.name],
    description: [base.description, proposed.description],
    period: [base.period, proposed.period],
    classification: [base.classification, proposed.classification],
    type: [base.type, proposed.type],
    years: [
      { from: base.from, to: base.to },
      { from: proposed.from, to: proposed.to },
    ],
  } as const;

  const rows = Object.entries(values).filter(
    ([, [before, after]]) => JSON.stringify(before) !== JSON.stringify(after),
  );
  const publishedById = new Map(
    (imagePreviews?.published || []).map((image) => [image.id, image]),
  );
  const stagedById = new Map(
    (imagePreviews?.staged || []).map((image) => [image.id, image]),
  );

  if (!rows.length && imageOperations.length === 0)
    return <p className="text-muted mb-0">No changes.</p>;

  return (
    <div className={compact ? "small" : ""}>
      {rows.map(([field, [before, after]]) => (
        <div className="source-changeset-diff-row" key={field}>
          <div className="fw-semibold small text-uppercase text-muted">
            {fieldLabels[field]}
          </div>
          <div className="source-changeset-diff-values">
            <span
              className="source-changeset-diff-before"
              aria-label="Removed or previous value"
            >
              <span aria-hidden="true">− </span>
              {formatValue(field, before)}
            </span>
            <span
              className="source-changeset-diff-after"
              aria-label="Added or proposed value"
            >
              <span aria-hidden="true">+ </span>
              {formatValue(field, after)}
            </span>
          </div>
        </div>
      ))}
      {imageOperations.length > 0 && (
        <div className="source-changeset-diff-row">
          <div className="fw-semibold small text-uppercase text-muted">
            Images
          </div>
          {imagePreviews ? (
            <div className="source-changeset-image-changes">
              {imageOperations.map((operation) => (
                <ImageOperationDiff
                  key={
                    operation.kind === "ADD"
                      ? operation.stagedImageId
                      : `${operation.kind}:${operation.imageId}`
                  }
                  operation={operation}
                  publishedById={publishedById}
                  stagedById={stagedById}
                />
              ))}
            </div>
          ) : (
            <ul className="mb-0 mt-2 ps-3">
              {imageOperations.map((operation) => (
                <li
                  key={
                    operation.kind === "ADD"
                      ? operation.stagedImageId
                      : `${operation.kind}:${operation.imageId}`
                  }
                >
                  {operation.kind === "ADD" && "Added image"}
                  {operation.kind === "REMOVE" && "Removed image"}
                  {operation.kind === "REPLACE" && "Replaced image"}
                  {operation.kind === "UPDATE_DESCRIPTION" &&
                    "Changed image description"}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
