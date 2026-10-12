import React, { useEffect, useRef, useState } from "react";
import { Button, Form } from "react-bootstrap";
import { FaGoogle } from "react-icons/fa";

const GoogleIcon = FaGoogle as React.ComponentType;

type AuthResponse = { error?: string };
type AuthAction = "register" | "login";

function safeReturnPath(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export function currentReturnTo(): string {
  const requested = safeReturnPath(new URLSearchParams(window.location.search).get("returnTo"));
  if (requested) return requested;
  const value = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

async function postAuth(path: string, body: Record<string, string>): Promise<AuthResponse> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as AuthResponse;
  if (!response.ok) throw new Error(data.error || "Authentication could not be completed.");
  return data;
}

/** Shared email/password and Google sign-in controls for the landing page and header modal. */
export default function AuthPanel() {
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registrationRequested, setRegistrationRequested] = useState(false);
  const returnTo = currentReturnTo();
  const confirmed = new URLSearchParams(window.location.search).get("registration") === "confirmed";

  // Authentication errors must never alter the landing or modal layout. They
  // are rendered as a short-lived overlay anchored to this fixed form instead.
  useEffect(() => {
    if (!error) return undefined;
    const timer = window.setTimeout(() => setError(null), 5_000);
    return () => window.clearTimeout(timer);
  }, [error]);

  const submit = async (action: AuthAction) => {
    if (!formRef.current?.reportValidity()) return;
    setBusy(true);
    setError(null);
    try {
      if (action === "register") {
        await postAuth("/auth/register", { email, password });
        setRegistrationRequested(true);
        return;
      }
      await postAuth("/auth/password-login", { email, password });
      window.location.assign(returnTo);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Authentication could not be completed.");
    } finally {
      setBusy(false);
    }
  };

  if (registrationRequested) {
    return <div className="auth-message auth-message-success" role="status">
      Check your inbox for a Tempvs email. Open the confirmation link to activate your account, then sign in to create your profile.
    </div>;
  }

  return <Form ref={formRef} className="auth-form" onSubmit={event => event.preventDefault()}>
    <p className="auth-form-copy">
      {confirmed
        ? "Your email is confirmed. Sign in to create your profile."
        : "Use your email and password to create an account or sign in."}
    </p>
    {error && <div className="auth-error-popover" role="alert">{error}</div>}
    <Form.Group className="auth-form-group" controlId="auth-email">
      <Form.Label className="auth-form-label">Email</Form.Label>
      <Form.Control className="auth-form-input" type="email" autoComplete="email" required disabled={busy} value={email} onChange={event => setEmail(event.target.value)} />
    </Form.Group>
    <Form.Group className="auth-form-group" controlId="auth-password">
      <Form.Label className="auth-form-label">Password</Form.Label>
      <Form.Control className="auth-form-input" type="password" autoComplete="current-password" minLength={12} required disabled={busy} value={password} onChange={event => setPassword(event.target.value)} />
    </Form.Group>
    <div className="d-grid">
      <Button className="auth-submit-button" type="button" disabled={busy} onClick={() => void submit("register")}>
        {busy ? "Please wait..." : "Register"}
      </Button>
    </div>
    <div className="auth-divider"><span>Or</span></div>
    <div className="d-grid">
      <Button className="auth-secondary-button" type="button" disabled={busy} onClick={() => void submit("login")}>
        Sign in
      </Button>
    </div>
    <div className="auth-divider"><span>Or</span></div>
    <div className="d-grid auth-oauth-grid">
      <Button as="a" href={`/auth/login?provider=Google&returnTo=${encodeURIComponent(returnTo)}`} variant="light" className="auth-oauth-button" aria-disabled={busy}>
        <GoogleIcon /> Sign in with Google
      </Button>
    </div>
  </Form>;
}
