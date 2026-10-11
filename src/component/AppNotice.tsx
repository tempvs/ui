import React from "react";
import { Button } from "react-bootstrap";

export type AppNoticeDetail = {
  message: string;
  tone?: "error" | "success" | "info";
};

const EVENT_NAME = "tempvs:app-notice";

/** Emits a non-blocking application notice from code that is outside React. */
export function showAppNotice(detail: AppNoticeDetail): void {
  window.dispatchEvent(new CustomEvent<AppNoticeDetail>(EVENT_NAME, { detail }));
}

/** A single, fixed notice surface so fetch failures never reflow page content. */
export default function AppNotice() {
  const [notice, setNotice] = React.useState<AppNoticeDetail | null>(null);

  React.useEffect(() => {
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<AppNoticeDetail>).detail;
      if (detail?.message) setNotice(detail);
    };
    window.addEventListener(EVENT_NAME, receive);
    return () => window.removeEventListener(EVENT_NAME, receive);
  }, []);

  React.useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  if (!notice) return null;
  return (
    <div
      className={`app-notice app-notice--${notice.tone ?? "error"}`}
      role="alert"
    >
      <span>{notice.message}</span>
      <Button
        aria-label="Dismiss notification"
        className="app-notice-dismiss"
        onClick={() => setNotice(null)}
        variant="link"
      >
        ×
      </Button>
    </div>
  );
}
