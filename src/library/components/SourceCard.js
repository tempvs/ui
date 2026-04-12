import React from 'react';
import { Badge, Card } from 'react-bootstrap';
import { useIntl } from 'react-intl';
import { Link } from 'react-router-dom';

import { getClassificationLabel, getTypeLabel, PeriodBadge } from '../libraryShared';

export default function SourceCard({ source }) {
  const intl = useIntl();

  return (
    <Card
      className="h-100 shadow-sm"
      style={{
        borderColor: '#d6d0b8',
      }}
    >
      <Card.Body className="d-flex flex-column">
        <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
          <Card.Title className="mb-0 fs-5">
            <Link
              to={`/library/source/${source.id}`}
              className="link-dark text-decoration-underline"
            >
              {source.name}
            </Link>
          </Card.Title>
          <PeriodBadge period={source.period} />
        </div>
        <Card.Text className="text-muted flex-grow-1">
          {source.description || '-'}
        </Card.Text>
        <div className="d-flex gap-2 flex-wrap mb-3">
          <Badge bg="secondary">{getClassificationLabel(intl, source.classification)}</Badge>
          <Badge bg="info">{getTypeLabel(intl, source.type)}</Badge>
        </div>
      </Card.Body>
    </Card>
  );
}
