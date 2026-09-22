import React, { FormEvent, useState } from 'react';
import { FaGoogle, FaSignInAlt } from 'react-icons/fa';
import { Button, Form, Modal, Nav, Tab } from 'react-bootstrap';
import { FormattedMessage } from 'react-intl';

import HeaderIconPopover from '../component/HeaderIconPopover';

const SignInIcon = FaSignInAlt as React.ComponentType;
const GoogleIcon = FaGoogle as React.ComponentType;

type Mode = 'login' | 'register' | 'confirm';
type AuthResponse = { error?: string };

async function postAuth(path: string, body: Record<string, string>): Promise<AuthResponse> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({})) as AuthResponse;
  if (!response.ok) throw new Error(data.error || 'Authentication could not be completed.');
  return data;
}

export default function LoginRegisterButton() {
  const [show, setShow] = useState(false);
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (busy) return;
    setShow(false);
    setError(null);
  };

  const selectMode = (next: 'login' | 'register') => {
    setMode(next);
    setError(null);
    setCode('');
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'register') {
        await postAuth('/auth/register', { email, password });
        setMode('confirm');
        return;
      }
      if (mode === 'confirm') {
        await postAuth('/auth/confirm-registration', { email, password, code });
        // A confirmed account has no domain profile yet. ProfilePage already
        // renders its normal creation form when the signed-in user has none.
        window.location.assign('/profile');
        return;
      }
      await postAuth('/auth/password-login', { email, password });
      window.location.assign('/');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Authentication could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  const registration = mode === 'register';
  const confirming = mode === 'confirm';
  const title = confirming ? 'Confirm your email' : registration ? 'Create your account' : 'Welcome back';

  return (
    <>
      <HeaderIconPopover text="login.popover" defaultMessage="Log in">
        <Button className="header-icon-button" variant="default" onClick={() => setShow(true)}>
          <SignInIcon />
        </Button>
      </HeaderIconPopover>

      <Modal show={show} onHide={close} centered dialogClassName="auth-modal-dialog" contentClassName="auth-modal-content">
        <Modal.Header closeButton={!busy} className="auth-modal-header">
          <div className="auth-modal-title-block">
            <span className="auth-modal-kicker">
              <FormattedMessage id="login.popover" defaultMessage="Log in" />
            </span>
            <Modal.Title className="auth-modal-title">{title}</Modal.Title>
          </div>
        </Modal.Header>
        <Modal.Body className="auth-modal-body">
          {!confirming && (
            <Tab.Container activeKey={mode} onSelect={key => selectMode(key === 'register' ? 'register' : 'login')}>
              <Nav className="auth-tabs" variant="tabs">
                <Nav.Item><Nav.Link eventKey="login" disabled={busy}>Sign in</Nav.Link></Nav.Item>
                <Nav.Item><Nav.Link eventKey="register" disabled={busy}>Register</Nav.Link></Nav.Item>
              </Nav>
            </Tab.Container>
          )}

          <Form className="auth-form" onSubmit={submit}>
            <p className="auth-form-copy">
              {confirming
                ? `Enter the code sent to ${email || 'your email address'} to finish creating your account.`
                : registration
                  ? 'Use your email and a secure password. You will confirm your email before continuing.'
                  : 'Sign in with your email and password, or continue with Google.'}
            </p>
            {error && <div className="auth-message auth-message-error" role="alert">{error}</div>}
            <Form.Group className="auth-form-group" controlId="auth-email">
              <Form.Label className="auth-form-label">Email</Form.Label>
              <Form.Control className="auth-form-input" type="email" autoComplete="email" required disabled={busy || confirming} value={email} onChange={event => setEmail(event.target.value)} />
            </Form.Group>
            <Form.Group className="auth-form-group" controlId="auth-password">
              <Form.Label className="auth-form-label">Password</Form.Label>
              <Form.Control className="auth-form-input" type="password" autoComplete={registration ? 'new-password' : 'current-password'} minLength={12} required disabled={busy} value={password} onChange={event => setPassword(event.target.value)} />
            </Form.Group>
            {confirming && (
              <Form.Group className="auth-form-group" controlId="auth-confirmation-code">
                <Form.Label className="auth-form-label">Verification code</Form.Label>
                <Form.Control className="auth-form-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required disabled={busy} value={code} onChange={event => setCode(event.target.value)} />
              </Form.Group>
            )}
            <Button className="auth-submit-button" type="submit" disabled={busy}>
              {busy ? 'Please wait…' : confirming ? 'Confirm and create profile' : registration ? 'Register' : 'Sign in'}
            </Button>
          </Form>

          {!confirming && (
            <>
              <div className="auth-divider"><span>or</span></div>
              <div className="d-grid auth-oauth-grid">
                <Button as="a" href="/auth/login?provider=Google" variant="light" className="auth-oauth-button" disabled={busy}>
                  <GoogleIcon /> Continue with Google
                </Button>
              </div>
            </>
          )}
        </Modal.Body>
      </Modal>
    </>
  );
}
