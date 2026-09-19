import React, { useEffect, useState } from 'react';
import { Button, Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import SectionBreadcrumb from '../../component/SectionBreadcrumb';
import Spinner from '../../component/Spinner';
import { getErrorMessage } from '../../util/errors';
import { getAdminRoleRequests, LibraryRoleRequest, updateAdminRoleRequest } from '../libraryApi';
import LibrarySectionHeader from '../components/LibrarySectionHeader';
import { PAGE_SIZE } from '../libraryShared';

export default function LibraryAdminPage() {
  const [loading, setLoading] = useState(true);
  const [roleRequests, setRoleRequests] = useState<LibraryRoleRequest[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const loadRoleRequests = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getAdminRoleRequests({ size: PAGE_SIZE });
      if (!result.ok) {
        throw new Error(result.status === 403 ? 'Admin access is required.' : 'Unable to load role requests.');
      }

      setRoleRequests(result.data?.roleRequests || []);
      setNextToken(result.data?.nextToken || null);
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setLoading(false);
    }
  };

  const loadMoreRoleRequests = async () => {
    if (!nextToken || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await getAdminRoleRequests({ size: PAGE_SIZE, nextToken });
      if (!result.ok) throw new Error('Unable to load more role requests.');
      setRoleRequests(current => [...current, ...(result.data?.roleRequests || [])]);
      setNextToken(result.data?.nextToken || null);
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadRoleRequests();
  }, []);

  const updateRoleRequest = async (role: string, userId: string, method: string) => {
    setError(null);
    setNotice(null);
    setUpdating(`${userId}:${role}`);

    try {
      const result = await updateAdminRoleRequest(role, userId, method);
      if (!result.ok) {
        throw new Error('Unable to update the role request.');
      }

      await loadRoleRequests();
      if (result.status === 202) {
        setNotice('Approval is queued. The user role will be granted asynchronously; check again before retrying.');
      }
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setUpdating(null);
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

      {error && <div className="tempvs-plain-message text-danger">{error}</div>}
      {notice && <div className="tempvs-plain-message text-muted" role="status">{notice}</div>}
      {loading && <Spinner />}
      {!loading && (
        <div className="d-flex flex-column gap-3">
          {roleRequests.length === 0 && (
            <div className="tempvs-plain-message text-muted mb-0">No pending role requests.</div>
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
                  <Button variant="outline-success" disabled={updating !== null} onClick={() => updateRoleRequest(request.role, request.userId, 'POST')}>
                    Approve
                  </Button>
                  <Button variant="outline-danger" disabled={updating !== null} onClick={() => updateRoleRequest(request.role, request.userId, 'DELETE')}>
                    Reject
                  </Button>
                </div>
              </Card.Body>
            </Card>
          ))}
          {nextToken && (
            <Button variant="outline-dark" disabled={loadingMore} onClick={loadMoreRoleRequests}>
              {loadingMore ? 'Loading...' : 'Load more requests'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
