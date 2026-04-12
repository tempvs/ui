import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Col, OverlayTrigger, Row } from 'react-bootstrap';
import { FormattedMessage } from 'react-intl';
import { Link } from 'react-router-dom';

import HoverPopover from '../../component/HoverPopover';
import Spinner from '../../component/Spinner';
import PeriodTile from '../PeriodTile';
import { getWelcome, updateRoleRequest } from '../libraryApi';
import LibrarySectionHeader from '../components/LibrarySectionHeader';
import { PERIODS } from '../libraryShared';
import { getPrimaryRoleMeta } from '../libraryRoles';

export default function LibraryLandingPage() {
  const [loading, setLoading] = useState(true);
  const [welcome, setWelcome] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [error, setError] = useState(null);

  const loadWelcome = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getWelcome();
      if (!result.ok) {
        throw new Error('Unable to load the library welcome panel.');
      }

      setWelcome(result.data);
      setUserInfo(result.userInfo);
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWelcome();
  }, []);

  const handleRoleAction = async () => {
    if (!welcome?.role) {
      return;
    }

    setError(null);
    const method = welcome.roleRequestAvailable ? 'POST' : 'DELETE';

    try {
      const result = await updateRoleRequest(welcome.role, method);
      if (!result.ok) {
        throw new Error('Unable to update the role request.');
      }

      setWelcome(result.data);
      setUserInfo(result.userInfo);
    } catch (fetchError) {
      setError(fetchError.message);
    }
  };

  const periods = useMemo(
    () => PERIODS.map(period => period.toLowerCase()),
    []
  );
  const roleMeta = getPrimaryRoleMeta(userInfo);

  const accessContent = loading ? (
    <div className="py-1">
      <Spinner />
    </div>
  ) : (
    <div className="d-flex align-items-center justify-content-center gap-2 flex-wrap">
      {roleMeta && (
        <OverlayTrigger
          trigger={['hover', 'focus']}
          placement="bottom"
          overlay={<HoverPopover text="" default={roleMeta.description} />}
        >
          <span className="fw-semibold" style={{ fontSize: '0.95rem', cursor: 'default' }}>
            {roleMeta.label}
          </span>
        </OverlayTrigger>
      )}
      {welcome?.adminPanelAvailable && (
        <Link to="/library/admin" className="btn btn-dark btn-sm">
          Open admin panel
        </Link>
      )}
      {!welcome?.adminPanelAvailable && welcome?.buttonText && welcome?.role && (
        <Button variant="outline-dark" size="sm" onClick={handleRoleAction}>
          {welcome.buttonText}
        </Button>
      )}
    </div>
  );

  return (
    <div className="px-4 px-xl-5 pb-4">
      <LibrarySectionHeader
        title="LIBRARY"
        subtitle={null}
        period={null}
        variant="landing"
        middleContent={accessContent}
      />
      {error && <Alert variant="danger" className="mt-3">{error}</Alert>}
      <Row className="g-4 align-items-start">
        <Col lg={12}>
          <div className="d-flex flex-column gap-3">
            <div>
              <h1 className="mb-2">
                <FormattedMessage id="periods.title" defaultMessage="Historical periods" />
              </h1>
              <p className="text-muted small mb-0">
                Browse the catalogue by era, then drill into individual sources and their image gallery.
              </p>
            </div>
            <Row className="g-3">
              {periods.map(period => (
                <Col md={6} xl={4} key={period}>
                  <Link to={`/library/period/${period}`} className="text-decoration-none text-reset">
                    <PeriodTile period={period} />
                  </Link>
                </Col>
              ))}
            </Row>
          </div>
        </Col>
      </Row>
    </div>
  );
}
