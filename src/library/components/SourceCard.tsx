import React from 'react';
import { Badge, Card, Image } from 'react-bootstrap';
import { useIntl } from 'react-intl';
import { Link } from 'react-router-dom';

import { getClassificationLabel, getTypeLabel, PeriodBadge } from '../libraryShared';

type SourceCardSource = {
  id: string | number;
  name?: string | null;
  description?: string | null;
  classification?: string | null;
  type?: string | null;
  period?: string | null;
};

type SourceCardImage = {
  url?: string | null;
  src?: string | null;
  fileName?: string | null;
};

type SourceCardProps = {
  source: SourceCardSource;
  showPeriodBadge?: boolean;
  firstImage?: SourceCardImage | null;
};

function getImageSrc(image: SourceCardImage): string {
  return image?.url || `data:image/jpeg;base64, ${image?.src || ''}`;
}

export default function SourceCard({ source, showPeriodBadge = true, firstImage = null }: SourceCardProps) {
  const intl = useIntl();

  return (
    <Card
      className="h-100 shadow-sm"
      style={{
        borderColor: '#d6d0b8',
      }}
    >
      <Card.Body className="source-card-body d-flex gap-3">
        {firstImage && (
          <Link to={`/library/source/${source.id}`} className="source-card-image-link">
            <Image
              alt={firstImage.fileName || source.name || 'Source image'}
              src={getImageSrc(firstImage)}
              className="source-card-image"
            />
          </Link>
        )}
        <div className="d-flex flex-column flex-grow-1" style={{ minWidth: 0 }}>
          <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
            <Card.Title className="mb-0 fs-5">
              <Link
                to={`/library/source/${source.id}`}
                className="link-dark text-decoration-underline"
              >
                {source.name}
              </Link>
            </Card.Title>
            {showPeriodBadge && <PeriodBadge period={source.period} />}
          </div>
          <Card.Text className="text-muted flex-grow-1">
            {source.description || '-'}
          </Card.Text>
          <div className="d-flex gap-2 flex-wrap mb-3">
            <Badge bg="secondary">{getClassificationLabel(intl, source.classification)}</Badge>
            <Badge bg="info">{getTypeLabel(intl, source.type)}</Badge>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
}
