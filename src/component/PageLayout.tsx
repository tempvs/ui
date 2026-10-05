import React from "react";
import { Container } from "react-bootstrap";

import PageHeader, { PageHeaderProps } from "./PageHeader";

export type PageLayoutHeader = PageHeaderProps;

type PageLayoutProps = {
  header: PageLayoutHeader;
  children: React.ReactNode;
  className?: string;
};

/**
 * Common routed-page frame. AppShell keeps the header tile mounted; this
 * component supplies its content and owns the shared body gutters.
 */
export default function PageLayout({ header, children, className = "" }: PageLayoutProps) {
  return (
    <main className={`page-layout ${className}`.trim()}>
      <PageHeader {...header} />
      <Container fluid className="page-layout-container px-4 px-xl-5 pb-4">
        <div className="page-layout-content">{children}</div>
      </Container>
    </main>
  );
}
