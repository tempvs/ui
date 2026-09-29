import React from 'react';
import { Dropdown } from 'react-bootstrap';

import { DEFAULT_HOURGLASS_IMAGE_SRC } from '../../component/DefaultHourglassImage';
import RefreshingImage from '../../image/RefreshingImage';
import { Profile } from '../profileTypes';
import './ProfilePicker.css';

export type ProfilePickerOption = {
  value: string;
  label: string;
  profile: Profile | null | undefined;
};

type ProfilePickerProps = {
  options: ProfilePickerOption[];
  value: string | null;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
};

/** Shared profile selector which always shows the selected profile's thumbnail. */
export default function ProfilePicker({ options, value, onChange, ariaLabel, className, disabled = false }: ProfilePickerProps) {
  const selected = options.find(option => option.value === value) || options[0];
  const renderImage = (profile: Profile | null | undefined) => <RefreshingImage
    image={{ resourceType: 'profile', resourceId: profile?.id, thumbnailUrl: profile?.avatarUrl }}
    variant="thumbnail"
    fallbackSrc={DEFAULT_HOURGLASS_IMAGE_SRC}
    className="profile-picker-image"
    alt=""
  />;

  return <Dropdown className={['profile-picker', className].filter(Boolean).join(' ')}>
    <Dropdown.Toggle aria-label={ariaLabel} disabled={disabled || !selected} className="profile-picker-toggle">
      {renderImage(selected?.profile)}
      <span className="profile-picker-label">{selected?.label || 'Select profile'}</span>
    </Dropdown.Toggle>
    <Dropdown.Menu className="profile-picker-menu">
      {options.map(option => <Dropdown.Item key={option.value} active={option.value === value} onClick={() => onChange(option.value)} className="profile-picker-option">
        {renderImage(option.profile)}
        <span>{option.label}</span>
      </Dropdown.Item>)}
    </Dropdown.Menu>
  </Dropdown>;
}
