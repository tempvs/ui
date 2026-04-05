import React, { useEffect, useMemo, useState } from 'react';
import { Col, Container, Row } from 'react-bootstrap';
import { injectIntl } from 'react-intl';
import { useParams } from 'react-router-dom';

import SectionHeaderBar from '../component/SectionHeaderBar';
import SectionBreadcrumb from '../component/SectionBreadcrumb';
import Spinner from '../component/Spinner';
import { getPeriodLabel as getSharedPeriodLabel } from '../util/periods';
import StashPanel from './StashPanel';
import { buildClubProfileLabel, buildProfileLabel } from './profileLabels';
import {
  fetchClubProfiles,
  fetchCurrentUserInfo,
  fetchOwnerUserProfile,
  fetchProfileById,
} from './profileApi';

function buildCanonicalProfilePath(profile) {
  return `/profile/${profile?.alias || profile?.id}`;
}

function StashPage({ intl }) {
  const { id } = useParams();
  const [loaded, setLoaded] = useState(false);
  const [profile, setProfile] = useState(null);
  const [ownerUserProfile, setOwnerUserProfile] = useState(null);
  const [clubProfiles, setClubProfiles] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);

  const t = (messageId, defaultMessage, values) => (
    intl.formatMessage({ id: messageId, defaultMessage }, values)
  );

  const getPeriodLabel = (period) => getSharedPeriodLabel(intl, period);

  useEffect(() => {
    fetchCurrentUserInfo(result => {
      setCurrentUserId(result.currentUserId || null);
    });
  }, []);

  useEffect(() => {
    setLoaded(false);
    fetchProfileById(id, {
      onSuccess: nextProfile => {
        setProfile(nextProfile || null);
        setLoaded(true);

        if (nextProfile?.userId) {
          fetchOwnerUserProfile(nextProfile.userId, {
            onSuccess: ownerProfile => setOwnerUserProfile(ownerProfile || null),
            onError: () => setOwnerUserProfile(null),
          });
          fetchClubProfiles(nextProfile.userId, {
            onSuccess: profiles => setClubProfiles(Array.isArray(profiles) ? profiles : []),
            onError: () => setClubProfiles([]),
          });
        } else {
          setOwnerUserProfile(null);
          setClubProfiles([]);
        }
      },
      onMissing: () => {
        setProfile(null);
        setOwnerUserProfile(null);
        setClubProfiles([]);
        setLoaded(true);
      },
    });
  }, [id]);

  const siblingClubProfiles = useMemo(
    () => clubProfiles.filter(clubProfile => clubProfile.id !== profile?.id),
    [clubProfiles, profile?.id]
  );
  const isEditable = profile?.type === 'CLUB' && currentUserId != null && currentUserId === profile?.userId;
  const ownerLabel = buildProfileLabel(ownerUserProfile);
  const clubLabel = buildClubProfileLabel(profile, getPeriodLabel);

  if (!loaded) {
    return <Spinner />;
  }

  if (!profile || profile.type !== 'CLUB') {
    return (
      <Container fluid className="px-4 px-xl-5 pb-4">
        {t('profile.stash.notFound', 'Club stash not found.')}
      </Container>
    );
  }

  return (
    <Container fluid className="px-4 px-xl-5 pb-4">
      <Row>
        <Col sm={12} className="mb-3">
          <SectionHeaderBar
            title="STASH"
            rightContent={(
              <SectionBreadcrumb
                items={[
                  ownerUserProfile ? { label: ownerLabel, to: buildCanonicalProfilePath(ownerUserProfile) } : null,
                  {
                    label: clubLabel,
                    to: buildCanonicalProfilePath(profile),
                    switcher: {
                      id: 'stash-club-profile-switcher',
                      emptyLabel: t('profile.clubProfiles.noneOther', 'No other club profiles'),
                      items: siblingClubProfiles.map(clubProfile => ({
                        key: clubProfile.id,
                        label: buildClubProfileLabel(clubProfile, getPeriodLabel),
                        to: `/stash/${clubProfile.alias || clubProfile.id}`,
                      })),
                    },
                  },
                  { label: 'Stash', to: `/stash/${profile.alias || profile.id}` },
                ]}
              />
            )}
            backgroundColor="#f8f4ea"
            borderColor="#d8c7a1"
          />
        </Col>
      </Row>
      <Row>
        <Col sm={12}>
          <StashPanel
            profile={{
              id: profile.id,
              userId: profile.userId,
              firstName: profile.firstName,
              lastName: profile.lastName,
              alias: profile.alias,
              period: profile.period,
              type: profile.type,
            }}
            isEditable={isEditable}
            t={t}
            getPeriodLabel={getPeriodLabel}
            embedded={false}
          />
        </Col>
      </Row>
    </Container>
  );
}

export default injectIntl(StashPage);
