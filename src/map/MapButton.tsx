import React from "react";
import { FaMapMarkedAlt } from "react-icons/fa";
import { Link } from "react-router-dom";
import HeaderIconPopover from "../component/HeaderIconPopover";

const MapIcon = FaMapMarkedAlt as React.ComponentType;

export default function MapButton() {
  return (
    <HeaderIconPopover text="map.title" defaultMessage="Map">
      <Link to="/map" className="header-icon-button" aria-label="Map">
        <MapIcon />
      </Link>
    </HeaderIconPopover>
  );
}
