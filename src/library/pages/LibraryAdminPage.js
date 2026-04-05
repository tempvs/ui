import React, { useEffect, useState } from 'react';
import { Alert, Button, Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import SectionBreadcrumb from '../../component/SectionBreadcrumb';
import Spinner from '../../component/Spinner';
import { getAdminRoleRequests, updateAdminRoleRequest } from '../libraryApi';
import LibrarySectionHeader from '../components/LibrarySectionHeader';
import { PAGE_SIZE } from '../libraryShared';

export default function LibraryAdminPage() {
  const [loading, setLoading] = useState(true);
  const [roleRequests, setRoleRequests] = useState([]);
  const [error, setError] = useState(null);

  const loadRoleRequests = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getAdminRoleRequests({ page: 0, size: PAGE_SIZE });
      if (!result.ok) {
        throw new Error(result.status === 403 ? 'Admin access is required.' : 'Unable to load role requests.');
      }

      setRoleRequests(result.data?.roleRequests || []);
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoleRequests();
  }, []);

  const updateRoleRequest = async (role, userId, method) => {
    setError(null);

    try {
      const result = await updateAdminRoleRequest(role, userId, method);
      if (!result.ok) {
        throw new Error('Unable to update the role request.');
      }

      setRoleRequests(result.data?.roleRequests || []);
    } catch (fetchError) {
      setError(fetchError.message);
    }
  };

  return (
    <div className="px-4 px-xl-5 pb-4">
      <LibrarySectionHeader
        title="LIBRARY"
        subtitle="Review contributor, scribe, and archivarius requests."
        period={null}
        variant="admin"
        rightContent={(
          <SectionBreadcrumb
            className="ms-auto"
            items={[
              { label: 'Library', to: '/library' },
              { label: 'Admin', to: '/library/admin' },
            ]}
          />
        )}
      />

      {error && <Alert variant="danger">{error}</Alert>}
      {loading && <Spinner />}
      {!loading && (
        <div className="d-flex flex-column gap-3">
          {roleRequests.length === 0 && (
            <Alert variant="light" className="border mb-0">No pending role requests.</Alert>
          )}
          {roleRequests.map(request => (
            <Card key={`${request.userId}-${request.role}`} className="border-0 shadow-sm">
              <Card.Body className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
                <div>
                  <div className="fw-semibold">
                    <Link to={`/profile/${request.profileId}`}>{request.userName}</Link>
                  </div>
                  <div className="text-muted small">{request.roleLabel}</div>
                </div>
                <div className="d-flex gap-2">
                  <Button variant="outline-success" onClick={() => updateRoleRequest(request.role, request.userId, 'POST')}>
                    Approve
                  </Button>
                  <Button variant="outline-danger" onClick={() => updateRoleRequest(request.role, request.userId, 'DELETE')}>
                    Reject
                  </Button>
                </div>
              </Card.Body>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
