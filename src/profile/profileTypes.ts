import { IntlShape } from 'react-intl';

import { SaveStatus } from '../component/EditableFieldRow';
import { GalleryImage } from '../component/StackedImageGallery';

export type Id = string | number;

export type MessageFormatter = (
  messageId: string,
  defaultMessage: string,
  values?: Record<string, string | number | boolean | Date>
) => string;

export type ProfileType = 'USER' | 'CLUB' | string;

export type Profile = {
  id: Id;
  userId?: Id | null;
  type?: ProfileType | null;
  firstName?: string | null;
  lastName?: string | null;
  nickName?: string | null;
  profileEmail?: string | null;
  location?: string | null;
  alias?: string | null;
  period?: string | null;
};

export type PersistedProfile = {
  profileId: Id | null;
  userId: Id | null;
  type: ProfileType | null;
  firstName: string;
  lastName: string;
  nickName: string;
  profileEmail: string;
  location: string;
  alias: string;
  period: string;
};

export type OauthProfile = {
  name?: string | null;
  email?: string | null;
  userId?: Id | null;
};

export type CurrentUserInfo = {
  currentUserId: Id | null;
  oauthProfile: OauthProfile | null;
};

export type Avatar = {
  content?: string | null;
  url?: string | null;
  description?: string | null;
};

export type ProfileField = 'firstName' | 'lastName' | 'nickName' | 'profileEmail' | 'location' | 'alias' | 'period';

export type ProfilePageProps = {
  id?: string | null;
  intl: IntlShape;
};

export type ProfilePageState = PersistedProfile & {
  avatarVisible: boolean;
  avatarLoaded: boolean;
  avatarImage?: string | null;
  avatarUrl?: string | null;
  avatarInfo?: string | null;
  loaded: boolean;
  notFound: boolean;
  createMode: boolean;
  currentUserId: Id | null;
  oauthProfile: OauthProfile | null;
  message: string | null;
  messageVariant: string | null;
  clubProfiles: Profile[];
  clubProfilesLoaded: boolean;
  clubProfilesMessage: string | null;
  ownerUserProfile: Profile | null;
  ownerUserProfileLoaded: boolean;
  clubProfileCreateVisible: boolean;
  clubProfileCreateError: boolean;
  clubProfileDeleteTarget: Profile | null;
  clubProfileDeleteError: boolean;
  avatarUploadStatus: SaveStatus | 'uploading' | 'success';
  avatarUploadMessage: string | null;
  avatarDescriptionDraft: string;
  avatarDescriptionStatus: SaveStatus;
  avatarDescriptionPersisted: string;
  persistedProfile: PersistedProfile | null;
  fieldStatuses: Partial<Record<ProfileField, SaveStatus>>;
};

export type Feedback = {
  variant: string;
  text: string;
};

export type DraftFields = {
  name: string;
  description: string;
};

export type FieldName = keyof DraftFields;

export type StashGroup = {
  id: Id;
  name?: string | null;
  description?: string | null;
  items?: StashItem[];
};

export type StashItem = {
  id: Id;
  name?: string | null;
  description?: string | null;
  classification?: string | null;
  period?: string | null;
  sources?: Id[] | null;
  itemGroup: {
    id: Id;
  };
};

export type Stash = {
  groups?: StashGroup[] | null;
};

export type LibrarySourceSummary = {
  id: Id;
  name?: string | null;
  type?: string | null;
  classification?: string | null;
  period?: string | null;
};

export type SourceSearchState = {
  query?: string;
  loading?: boolean;
  error?: string | null;
  results?: LibrarySourceSummary[];
};

export type StashItemImage = GalleryImage;

export type ReplacingItemImage = {
  itemId: Id;
  image: StashItemImage;
};

export type StashPanelProps = {
  profile: Profile | null;
  isEditable: boolean;
  t: MessageFormatter;
  getPeriodLabel: (period?: string | null) => string;
  embedded?: boolean;
};
