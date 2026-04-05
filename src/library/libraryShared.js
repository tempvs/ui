export { PERIODS, getPeriodLabel, PeriodBadge } from '../util/periods';

export const CLASSIFICATIONS = ['CLOTHING', 'FOOTWEAR', 'HOUSEHOLD', 'WEAPON', 'ARMOR', 'OTHER'];
export const TYPES = ['WRITTEN', 'GRAPHIC', 'ARCHAEOLOGICAL', 'OTHER'];
export const PAGE_SIZE = 40;

const CLASSIFICATION_DEFAULTS = {
  CLOTHING: 'Clothing',
  FOOTWEAR: 'Footwear',
  HOUSEHOLD: 'Household',
  WEAPON: 'Weapon',
  ARMOR: 'Armor',
  OTHER: 'Other',
};

const TYPE_DEFAULTS = {
  WRITTEN: 'Written',
  GRAPHIC: 'Graphic',
  ARCHAEOLOGICAL: 'Archaeological',
  OTHER: 'Other',
};

export function getClassificationLabel(intl, classification) {
  if (!classification) {
    return '';
  }

  return intl.formatMessage({
    id: `library.classification.${classification.toLowerCase()}`,
    defaultMessage: CLASSIFICATION_DEFAULTS[classification] || classification,
  });
}

export function getTypeLabel(intl, type) {
  if (!type) {
    return '';
  }

  return intl.formatMessage({
    id: `library.type.${type.toLowerCase()}`,
    defaultMessage: TYPE_DEFAULTS[type] || type,
  });
}
