import React, { useEffect, useMemo, useState } from 'react';
import { Col, Container, Row } from 'react-bootstrap';
import { injectIntl, IntlShape } from 'react-intl';
import { Link, useParams } from 'react-router-dom';

import SectionHeaderBar from '../component/SectionHeaderBar';
import SectionBreadcrumb from '../component/SectionBreadcrumb';
import Spinner from '../component/Spinner';
import { getClassificationLabel, getTypeLabel } from '../library/libraryShared';
import { getPeriodLabel as getSharedPeriodLabel } from '../util/periods';
import { buildClubProfileLabel } from './profileLabels';
import { fetchProfileById } from './profileApi';
import { getLibrarySourcesByIds, getStashEntityImages, getStashItem } from './stashApi';
import { EntityImage, Id, LibrarySourceSummary, Profile, StashItem } from './profileTypes';

type StashItemPageProps = {
  intl: IntlShape;
};

type IdRecord<T> = Record<string, T>;

function toRecordKey(value: Id) {
  return String(value);
}

function getImageSrc(image?: EntityImage | null) {
  if (!image) {
    return null;
  }

  if (image.url) {
    return image.url;
  }

  if (image.src) {
    return `data:image/jpeg;base64, ${image.src}`;
  }

  return null;
}

function buildFirstImageMap(images: EntityImage[]) {
  return images.reduce<IdRecord<EntityImage>>((accumulator, image) => {
    const entityId = image.entityId || '';
    if (!entityId || accumulator[entityId]) {
      return accumulator;
    }

    return {
      ...accumulator,
      [entityId]: image,
    };
  }, {});
}

function StashItemPage({ intl }: StashItemPageProps) {
  const { id, itemId } = useParams();
  const [loaded, setLoaded] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [item, setItem] = useState<StashItem | null>(null);
  const [itemImages, setItemImages] = useState<EntityImage[]>([]);
  const [sources, setSources] = useState<LibrarySourceSummary[]>([]);
  const [sourceImages, setSourceImages] = useState<IdRecord<EntityImage>>({});

  const t = (messageId: string, defaultMessage: string, values?: Record<string, string | number | boolean | Date>) => (
    intl.formatMessage({ id: messageId, defaultMessage }, values)
  );

  const getPeriodLabel = (period?: string | null) => getSharedPeriodLabel(intl, period);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoaded(false);

      try {
        const nextItem = await getStashItem(itemId || '');
        const nextProfile = await new Promise<Profile | null>(resolve => {
          fetchProfileById(id, {
            onSuccess: value => resolve(value || null),
            onMissing: () => resolve(null),
          });
        });

        if (!active) {
          return;
        }

        setItem(nextItem || null);
        setProfile(nextProfile || null);

        const [nextItemImages, nextSources] = await Promise.all([
          getStashEntityImages('item', nextItem?.id ? [nextItem.id] : []),
          getLibrarySourcesByIds(nextItem?.sources || []),
        ]);

        if (!active) {
          return;
        }

        setItemImages(Array.isArray(nextItemImages) ? nextItemImages : []);
        setSources(Array.isArray(nextSources) ? nextSources : []);

        const nextSourceImages = await getStashEntityImages('source', (nextSources || []).map(source => source.id));
        if (!active) {
          return;
        }

        setSourceImages(buildFirstImageMap(nextSourceImages));
      } catch (error) {
        if (!active) {
          return;
        }

        setItem(null);
        setProfile(null);
        setItemImages([]);
        setSources([]);
        setSourceImages({});
      } finally {
        if (active) {
          setLoaded(true);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [id, itemId]);

  const itemImage = useMemo(() => itemImages[0] || null, [itemImages]);
  const itemImageSrc = getImageSrc(itemImage);

  if (!loaded) {
    return <Spinner />;
  }

  if (!profile || !item) {
    return (
      <Container fluid className="px-4 px-xl-5 pb-4">
        {t('profile.stash.notFound', 'Club stash not found.')}
      </Container>
    );
  }

  const clubLabel = buildClubProfileLabel(profile, getPeriodLabel);

  return (
    <Container fluid className="px-4 px-xl-5 pb-4">
      <Row>
        <Col sm={12} className="mb-3">
          <SectionHeaderBar
            title="ITEM"
            rightContent={(
              <SectionBreadcrumb
                items={[
                  { label: clubLabel, to: `/stash/${profile.alias || profile.id}` },
                  { label: item.name || t('profile.stash.itemName', 'Item'), to: `/stash/${profile.alias || profile.id}/items/${item.id}` },
                ]}
              />
            )}
            backgroundColor="#f8f4ea"
            borderColor="#d8c7a1"
          />
        </Col>
      </Row>

      <div className="stash-item-page-shell">
        <div className="stash-item-page-hero">
          {itemImageSrc && (
            <div className="stash-item-page-main-image-shell">
              <img src={itemImageSrc} alt={item.name || 'Item'} className="stash-item-page-main-image" />
            </div>
          )}
          <div className="stash-item-page-copy">
            <h1 className="stash-item-page-title">{item.name}</h1>
            <p className="stash-item-page-description">
              {item.description || t('profile.stash.noDescription', 'No description')}
            </p>
            <div className="stash-meta-row">
              <span className="stash-meta-chip stash-meta-chip-soft">
                {getClassificationLabel(intl, item.classification)}
              </span>
              <span className="stash-meta-chip stash-meta-chip-soft">
                {getPeriodLabel(item.period)}
              </span>
              <span className="stash-meta-chip stash-meta-chip-soft">
                {sources.length} {t('profile.stash.sourcesCount', 'source(s)')}
              </span>
              <span className="stash-meta-chip stash-meta-chip-soft">
                {itemImages.length} {t('profile.stash.imagesCount', 'image(s)')}
              </span>
            </div>
          </div>
        </div>

        <section className="stash-source-list-shell">
          <div className="stash-source-list-header">
            <h2 className="stash-source-list-title">{t('profile.stash.sourcesTitle', 'Sources')}</h2>
            <Link className="stash-inline-link" to={`/stash/${profile.alias || profile.id}`}>
              {t('profile.stash.collectionsTitle', 'Collections')}
            </Link>
          </div>

          {sources.length === 0 && (
            <div className="stash-empty-state stash-empty-state--compact">
              <div className="small text-muted">{t('profile.stash.sourcesEmpty', 'No supporting sources linked yet.')}</div>
            </div>
          )}

          {sources.map(source => {
            const sourceImage = sourceImages[toRecordKey(source.id)];
            const sourceImageSrc = getImageSrc(sourceImage);

            return (
              <Link key={source.id} to={`/library/source/${source.id}`} className="stash-source-card">
                {sourceImageSrc && (
                  <div className="stash-source-thumb-shell">
                    <img src={sourceImageSrc} alt={source.name || 'Source'} className="stash-source-thumb" />
                  </div>
                )}
                <div className="stash-source-copy">
                  <div className="stash-source-title">{source.name}</div>
                  <div className="stash-source-description">
                    {source.description || t('profile.stash.noDescription', 'No description')}
                  </div>
                  <div className="stash-meta-row">
                    <span className="stash-meta-chip stash-meta-chip-soft">
                      {getTypeLabel(intl, source.type)}
                    </span>
                    {source.classification && (
                      <span className="stash-meta-chip stash-meta-chip-soft">
                        {getClassificationLabel(intl, source.classification)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </section>
      </div>
    </Container>
  );
}

export default injectIntl(StashItemPage);
