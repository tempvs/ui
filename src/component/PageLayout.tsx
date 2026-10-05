import React from "react";
import { Container } from "react-bootstrap";

import SectionHeaderBar from "./SectionHeaderBar";

export type PageLayoutHeader = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  middleContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  backgroundColor?: string;
  borderColor?: string;
};

type PageLayoutProps = {
  header: PageLayoutHeader;
  children: React.ReactNode;
  className?: string;
};

/**
 * Common routed-page frame. The persistent navigation belongs to AppShell;
 * this component owns the shared jumbo header and consistent page gutters.
 */
export default function PageLayout({ header, children, className = "" }: PageLayoutProps) {
  return (
    <main className={`page-layout ${className}`.trim()}>
      <Container fluid className="page-layout-container px-4 px-xl-5 pb-4">
        <SectionHeaderBar {...header} />
        <div className="page-layout-content">{children}</div>
      </Container>
    </main>
  );
}
