import React from "react";
import { Container } from "react-bootstrap";
import { createPortal } from "react-dom";

import SectionHeaderBar from "./SectionHeaderBar";

export type PageHeaderProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  middleContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  backgroundColor?: string;
  borderColor?: string;
};

export type PageShellOutletContext = {
  headerMount: HTMLDivElement;
};

export const PageShellContext = React.createContext<PageShellOutletContext | null>(null);

/**
 * Renders routed-page header content into the persistent AppShell mount. The
 * shell owns the tile, its gutters, and its vertical position; route changes
 * replace only this content and the body below it.
 */
export default function PageHeader(props: PageHeaderProps) {
  const shell = React.useContext(PageShellContext);
  const header = <SectionHeaderBar {...props} />;

  if (shell?.headerMount) {
    return createPortal(header, shell.headerMount);
  }

  // Keeps isolated component stories/tests useful outside AppShell.
  return (
    <Container fluid className="page-layout-header-fallback px-4 px-xl-5">
      {header}
    </Container>
  );
}
