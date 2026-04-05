import React from 'react';
import { Badge, Button, Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import { PeriodBadge } from '../libraryShared';

export default function SourceCard({ source }) {
  return (
    <Card className="h-100 border-0 shadow-sm">
      <Card.Body className="d-flex flex-column">
        <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
          <Card.Title className="mb-0 fs-5">{source.name}</Card.Title>
          <PeriodBadge period={source.period} />
        </div>
        <Card.Text className="text-muted flex-grow-1">
          {source.description || 'No description yet.'}
        </Card.Text>
        <div className="d-flex gap-2 flex-wrap mb-3">
          <Badge bg="secondary">{source.classification}</Badge>
          <Badge bg="info">{source.type}</Badge>
        </div>
        <Button as={Link} to={`/library/source/${source.id}`} variant="outline-dark">
          Open source
        </Button>
      </Card.Body>
    </Card>
  );
}
