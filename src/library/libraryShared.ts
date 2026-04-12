import { IntlShape } from 'react-intl';

export { PERIODS, getPeriodLabel, PeriodBadge } from '../util/periods';
export type { Period } from '../util/periods';

export const CLASSIFICATIONS = ['CLOTHING', 'FOOTWEAR', 'HOUSEHOLD', 'WEAPON', 'ARMOR', 'OTHER'] as const;
export const TYPES = ['WRITTEN', 'GRAPHIC', 'ARCHAEOLOGICAL', 'OTHER'] as const;
export const PAGE_SIZE = 40;

export type SourceClassification = typeof CLASSIFICATIONS[number];
export type SourceType = typeof TYPES[number];

const CLASSIFICATION_DEFAULTS: Record<SourceClassification, string> = {
  CLOTHING: 'Clothing',
  FOOTWEAR: 'Footwear',
  HOUSEHOLD: 'Household',
  WEAPON: 'Weapon',
  ARMOR: 'Armor',
  OTHER: 'Other',
};

const TYPE_DEFAULTS: Record<SourceType, string> = {
  WRITTEN: 'Written',
  GRAPHIC: 'Graphic',
  ARCHAEOLOGICAL: 'Archaeological',
  OTHER: 'Other',
};

function hasClassificationDefault(value: string): value is SourceClassification {
  return value in CLASSIFICATION_DEFAULTS;
}

function hasTypeDefault(value: string): value is SourceType {
  return value in TYPE_DEFAULTS;
}

export function getClassificationLabel(intl: IntlShape, classification: string | null | undefined): string {
  if (!classification) {
    return '';
  }

  return intl.formatMessage({
    id: `library.classification.${classification.toLowerCase()}`,
    defaultMessage: hasClassificationDefault(classification)
      ? CLASSIFICATION_DEFAULTS[classification]
      : classification,
  });
}

export function getTypeLabel(intl: IntlShape, type: string | null | undefined): string {
  if (!type) {
    return '';
  }

  return intl.formatMessage({
    id: `library.type.${type.toLowerCase()}`,
    defaultMessage: hasTypeDefault(type) ? TYPE_DEFAULTS[type] : type,
  });
}
