import React, { useState } from "react";
import { Button, Dropdown } from "react-bootstrap";
import { FormattedMessage, useIntl } from "react-intl";

type AccountMenuProps = {
  avatarUrl?: string | null;
  avatarText?: string | null;
  name?: string | null;
};

export default function AccountMenu({ avatarUrl, avatarText, name }: AccountMenuProps) {
  const intl = useIntl();
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const hasAvatar = Boolean(avatarUrl && avatarUrl !== failedAvatarUrl);

  return (
    <Dropdown align="end" className="auth-account-menu">
      <Dropdown.Toggle
        id="header-account-menu"
        variant="default"
        className="header-icon-button auth-avatar-toggle"
        aria-label={intl.formatMessage({ id: "auth.account.menu", defaultMessage: "Account menu" })}
      >
        <span className={`auth-avatar-badge${hasAvatar ? "" : " auth-avatar-text"}`} aria-hidden="true">
          {hasAvatar ? (
            <img className="auth-avatar-image" src={avatarUrl!} alt="" referrerPolicy="no-referrer"
              onError={() => setFailedAvatarUrl(avatarUrl || null)} />
          ) : avatarText || "?"}
        </span>
      </Dropdown.Toggle>
      <Dropdown.Menu className="auth-account-dropdown">
        <Dropdown.Header className="auth-account-name">
          {name || <FormattedMessage id="auth.account.name" defaultMessage="My account" />}
        </Dropdown.Header>
        <Dropdown.Divider />
        <form method="post" action="/auth/logout">
          <Button type="submit" variant="default" className="dropdown-item auth-account-logout">
            <FormattedMessage id="logout.popover" defaultMessage="Log out" />
          </Button>
        </form>
      </Dropdown.Menu>
    </Dropdown>
  );
}
