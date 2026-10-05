import React from "react";

type PageColumnsProps = {
  children: React.ReactNode;
  variant?: "one" | "two" | "three";
  className?: string;
};

type PageColumnProps = {
  children: React.ReactNode;
  className?: string;
};

/** Standard responsive content grid for routable entity pages. */
export function PageColumns({ children, variant = "one", className = "" }: PageColumnsProps) {
  return <div className={`page-columns page-columns--${variant} ${className}`.trim()}>{children}</div>;
}

export function PageColumn({ children, className = "" }: PageColumnProps) {
  return <div className={`page-column ${className}`.trim()}>{children}</div>;
}
