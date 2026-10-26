import React from "react";

type EntityDetailPageProps = {
  children: React.ReactNode;
  className?: string;
};

/** Shared width and overflow foundation for profile, club, item, and source details. */
export default function EntityDetailPage({
  children,
  className = "",
}: EntityDetailPageProps) {
  return (
    <div className={`entity-detail-page ${className}`.trim()}>{children}</div>
  );
}
