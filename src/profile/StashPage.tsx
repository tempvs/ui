import React, { useCallback, useEffect, useMemo, useState } from "react";
import { injectIntl, IntlShape } from "react-intl";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import PageLayout from "../component/PageLayout";
import { PageColumn, PageColumns } from "../component/PageColumns";
import SectionBreadcrumb from "../component/SectionBreadcrumb";
import Spinner from "../component/Spinner";
import { getPeriodLabel as getSharedPeriodLabel } from "../util/periods";
import StashOverview from "./StashOverview";
import { buildClubProfileLabel, buildProfileLabel } from "./profileLabels";
import {
  fetchClubProfiles,
  fetchCurrentUserInfo,
  fetchOwnerUserProfile,
  fetchProfileById,
} from "./profileApi";
import { Id, Profile, StashGroup } from "./profileTypes";

function buildCanonicalProfilePath(profile: Profile | null) {
  return `/profile/${profile?.alias || profile?.id}`;
}

type StashPageProps = {
  intl: IntlShape;
};

function StashPage({ intl }: StashPageProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loaded, setLoaded] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ownerUserProfile, setOwnerUserProfile] = useState<Profile | null>(
    null,
  );
  const [clubProfiles, setClubProfiles] = useState<Profile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<Id | null>(null);
  const [activeGroup, setActiveGroup] = useState<{
    id: Id;
    name?: string | null;
  } | null>(null);
  const [groups, setGroups] = useState<StashGroup[]>([]);

  const t = useCallback(
    (
      messageId: string,
      defaultMessage: string,
      values?: Record<string, string | number | boolean | Date>,
    ) => intl.formatMessage({ id: messageId, defaultMessage }, values),
    [intl],
  );

  const getPeriodLabel = useCallback(
    (period?: string | null) => getSharedPeriodLabel(intl, period),
    [intl],
  );

  useEffect(() => {
    fetchCurrentUserInfo((result) => {
      setCurrentUserId(result.currentUserId || null);
    });
  }, []);

  useEffect(() => {
    setLoaded(false);
    fetchProfileById(id, {
      onSuccess: (nextProfile) => {
        setProfile(nextProfile || null);
        setLoaded(true);

        if (nextProfile?.userId) {
          fetchOwnerUserProfile(nextProfile.userId, {
            onSuccess: (ownerProfile) =>
              setOwnerUserProfile(ownerProfile || null),
            onError: () => setOwnerUserProfile(null),
          });
          fetchClubProfiles(nextProfile.userId, {
            onSuccess: (profiles) =>
              setClubProfiles(Array.isArray(profiles) ? profiles : []),
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
    () => clubProfiles.filter((clubProfile) => clubProfile.id !== profile?.id),
    [clubProfiles, profile?.id],
  );
  const requestedGroupId = searchParams.get("group");
  const isEditable =
    profile?.type === "CLUB" &&
    currentUserId != null &&
    currentUserId === profile?.userId;
  const ownerLabel = buildProfileLabel(ownerUserProfile);
  const clubLabel = buildClubProfileLabel(profile, getPeriodLabel);
  const handleActiveGroupChange = useCallback(
    (group: { id: Id; name?: string | null } | null) => {
      setActiveGroup((previousState) => {
        if (
          String(previousState?.id ?? "") === String(group?.id ?? "") &&
          previousState?.name === group?.name
        ) {
          return previousState;
        }

        return group;
      });

      // The collection panel is the authority for resolving a requested
      // collection (including a stale/missing id).  Update the URL here,
      // rather than in a second effect that can race a breadcrumb navigation.
      if (!profile || !group || requestedGroupId === String(group.id)) {
        return;
      }
      navigate(`/stash/${profile.alias || profile.id}?group=${group.id}`, {
        replace: true,
      });
    },
    [navigate, profile, requestedGroupId],
  );

  if (!loaded) {
    return (
      <PageLayout header={{ title: "Owned items" }}>
        <Spinner />
      </PageLayout>
    );
  }

  if (!profile || profile.type !== "CLUB") {
    return (
      <PageLayout header={{ title: "Owned items" }}>
        {t("profile.stash.notFound", "Club stash not found.")}
      </PageLayout>
    );
  }

  return (
    <PageLayout
      header={{
        title: (
          <SectionBreadcrumb
            items={[
              ownerUserProfile
                ? {
                    label: ownerLabel,
                    to: buildCanonicalProfilePath(ownerUserProfile),
                  }
                : null,
              {
                label: clubLabel,
                to: buildCanonicalProfilePath(profile),
                switcher: {
                  id: "stash-club-profile-switcher",
                  emptyLabel: t(
                    "profile.clubProfiles.noneOther",
                    "No other club profiles",
                  ),
                  items: siblingClubProfiles.map((clubProfile) => ({
                    key: clubProfile.id,
                    label: buildClubProfileLabel(clubProfile, getPeriodLabel),
                    to: `/stash/${clubProfile.alias || clubProfile.id}`,
                  })),
                },
              },
              activeGroup
                ? {
                    label:
                      activeGroup.name ||
                      t("profile.stash.groupName", "Collection"),
                    to: `/stash/${profile.alias || profile.id}?group=${activeGroup.id}`,
                    switcher: {
                      id: "stash-collection-switcher",
                      emptyLabel: t(
                        "profile.stash.collectionsEmpty",
                        "No collections",
                      ),
                      items: groups.map((group) => ({
                        key: group.id,
                        label:
                          group.name ||
                          t("profile.stash.groupName", "Collection"),
                        to: `/stash/${profile.alias || profile.id}?group=${group.id}`,
                        active: String(group.id) === String(activeGroup.id),
                      })),
                    },
                  }
                : null,
            ]}
          />
        ),
        rightContent: isEditable ? (
          <Link
            className="btn btn-outline-dark"
            to={`/stash/${profile.alias || profile.id}/admin`}
          >
            {t("profile.stash.manage", "Manage stash")}
          </Link>
        ) : null,
        backgroundColor: "#f8f4ea",
        borderColor: "#d8c7a1",
      }}
    >
      <PageColumns>
        <PageColumn>
          <StashOverview
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
            initialGroupId={requestedGroupId}
            onActiveGroupChange={handleActiveGroupChange}
            onGroupsChange={setGroups}
          />
        </PageColumn>
      </PageColumns>
    </PageLayout>
  );
}

export default injectIntl(StashPage);
