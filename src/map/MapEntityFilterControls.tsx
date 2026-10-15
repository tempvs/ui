import React from "react";
import { Form } from "react-bootstrap";

import HistoricalRangeFilter, {
  type HistoricalYearInput,
} from "../component/HistoricalRangeFilter";
import { ClassificationSelect } from "../library/components/ClassificationSelect";
import { PERIODS, TYPES } from "../library/libraryShared";
import type { MapEntityLocation, SourceLocationRole } from "./mapApi";

type Props = {
  idPrefix: string;
  entityTypes: MapEntityLocation["entityType"][];
  onEntityTypesChange: (types: MapEntityLocation["entityType"][]) => void;
  period: string;
  onPeriodChange: (value: string) => void;
  from: HistoricalYearInput;
  onFromChange: (value: HistoricalYearInput) => void;
  to: HistoricalYearInput;
  onToChange: (value: HistoricalYearInput) => void;
  sourceRoles: SourceLocationRole[];
  onSourceRolesChange: (roles: SourceLocationRole[]) => void;
  sourceClassification: string;
  onSourceClassificationChange: (value: string) => void;
  sourceType: string;
  onSourceTypeChange: (value: string) => void;
  eventRoles: Array<"VENUE" | "HISTORICAL_SITE">;
  onEventRolesChange: (roles: Array<"VENUE" | "HISTORICAL_SITE">) => void;
  profileType: string;
  onProfileTypeChange: (value: string) => void;
};

const allEntityTypes: MapEntityLocation["entityType"][] = [
  "PROFILE",
  "CLUB",
  "EVENT",
  "SOURCE",
];

/** One common historical context keeps discovery simple; entity-specific
 * facets stay available without competing period/year controls. */
export default function MapEntityFilterControls({
  idPrefix,
  entityTypes,
  onEntityTypesChange,
  period,
  onPeriodChange,
  from,
  onFromChange,
  to,
  onToChange,
  sourceRoles,
  onSourceRolesChange,
  sourceClassification,
  onSourceClassificationChange,
  sourceType,
  onSourceTypeChange,
  eventRoles,
  onEventRolesChange,
  profileType,
  onProfileTypeChange,
}: Props) {
  const toggleEntityType = (type: MapEntityLocation["entityType"]) =>
    onEntityTypesChange(
      entityTypes.includes(type)
        ? entityTypes.filter((value) => value !== type)
        : [...entityTypes, type],
    );
  const toggleSourceRole = (role: SourceLocationRole) =>
    onSourceRolesChange(
      sourceRoles.includes(role)
        ? sourceRoles.filter((value) => value !== role)
        : [...sourceRoles, role],
    );
  const toggleEventRole = (role: "VENUE" | "HISTORICAL_SITE") =>
    onEventRolesChange(
      eventRoles.includes(role)
        ? eventRoles.filter((value) => value !== role)
        : [...eventRoles, role],
    );

  return (
    <div className="map-entity-filter-controls">
      <Form.Group className="map-filter-layers mb-0">
        <Form.Label>Show</Form.Label>
        <div className="d-flex gap-2 flex-wrap">
          {allEntityTypes.map((type) => (
            <Form.Check
              inline
              key={type}
              id={`${idPrefix}-type-${type}`}
              label={type[0] + type.slice(1).toLowerCase()}
              checked={entityTypes.includes(type)}
              onChange={() => toggleEntityType(type)}
            />
          ))}
        </div>
      </Form.Group>
      <Form.Group className="map-filter-period mb-0">
        <Form.Label>Period</Form.Label>
        <Form.Select
          size="sm"
          value={period}
          onChange={(event) => onPeriodChange(event.target.value)}
          aria-label="Period"
        >
          <option value="">All periods</option>
          {PERIODS.map((value) => (
            <option key={value} value={value}>
              {readable(value)}
            </option>
          ))}
        </Form.Select>
      </Form.Group>
      <div className="map-filter-years">
        <HistoricalRangeFilter
          label="Years"
          enabled
          showToggle={false}
          alwaysShowFields
          from={from}
          to={to}
          onEnabledChange={() => undefined}
          onFromChange={onFromChange}
          onToChange={onToChange}
          compact
          className="mb-0"
        />
      </div>
      <details className="map-advanced-filters">
        <summary>More filters</summary>
        <div className="map-advanced-filters-content">
          {entityTypes.includes("SOURCE") && (
            <>
              <Form.Group className="mb-2">
                <Form.Label>Source place</Form.Label>
                <div className="d-flex gap-2 flex-wrap">
                  {(
                    [
                      ["DISCOVERED_AT", "Discovered at"],
                      ["HELD_AT", "Held at"],
                    ] as const
                  ).map(([role, label]) => (
                    <Form.Check
                      inline
                      key={role}
                      id={`${idPrefix}-source-role-${role}`}
                      label={label}
                      checked={sourceRoles.includes(role)}
                      onChange={() => toggleSourceRole(role)}
                    />
                  ))}
                </div>
              </Form.Group>
              <Form.Group className="mb-2">
                <Form.Label>Classification</Form.Label>
                <ClassificationSelect
                  size="sm"
                  value={sourceClassification}
                  onChange={onSourceClassificationChange}
                  placeholder="All classifications"
                />
              </Form.Group>
              <Form.Group className="mb-2">
                <Form.Label>Source type</Form.Label>
                <Form.Select
                  size="sm"
                  value={sourceType}
                  onChange={(event) => onSourceTypeChange(event.target.value)}
                >
                  <option value="">All types</option>
                  {TYPES.map((type) => (
                    <option key={type} value={type}>
                      {readable(type)}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </>
          )}
          {entityTypes.includes("EVENT") && (
            <Form.Group className="mb-2">
              <Form.Label>Event place</Form.Label>
              <div className="d-flex gap-2 flex-wrap">
                {(
                  [
                    ["VENUE", "Venue"],
                    ["HISTORICAL_SITE", "Historical site"],
                  ] as const
                ).map(([role, label]) => (
                  <Form.Check
                    inline
                    key={role}
                    id={`${idPrefix}-event-role-${role}`}
                    label={label}
                    checked={eventRoles.includes(role)}
                    onChange={() => toggleEventRole(role)}
                  />
                ))}
              </div>
            </Form.Group>
          )}
          {entityTypes.includes("PROFILE") && (
            <Form.Group className="mb-0">
              <Form.Label>Profile type</Form.Label>
              <Form.Select
                size="sm"
                value={profileType}
                onChange={(event) => onProfileTypeChange(event.target.value)}
              >
                <option value="">All profile types</option>
                <option value="USER">User</option>
                <option value="CLUB">Club</option>
              </Form.Select>
            </Form.Group>
          )}
        </div>
      </details>
    </div>
  );
}

function readable(value: string): string {
  return value
    .toLocaleLowerCase()
    .split("_")
    .map((part) => part.slice(0, 1).toLocaleUpperCase() + part.slice(1))
    .join(" ");
}
