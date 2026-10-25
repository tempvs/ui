import React from "react";
import { Form } from "react-bootstrap";

import HistoricalRangeFilter, {
  type HistoricalYearInput,
} from "../component/HistoricalRangeFilter";
import { PERIODS, TYPES } from "../library/libraryShared";
import type { MapEntityLocation, SourceLocationRole } from "./mapApi";

type Props = {
  idPrefix: string;
  entityTypes: MapEntityLocation["entityType"][];
  onEntityTypesChange: (types: MapEntityLocation["entityType"][]) => void;
  from: HistoricalYearInput;
  onFromChange: (value: HistoricalYearInput) => void;
  to: HistoricalYearInput;
  onToChange: (value: HistoricalYearInput) => void;
  sourceRoles: SourceLocationRole[];
  onSourceRolesChange: (roles: SourceLocationRole[]) => void;
  sourceType: string;
  onSourceTypeChange: (value: string) => void;
  sourcePeriods: string[];
  onSourcePeriodsChange: (periods: string[]) => void;
  eventRoles: Array<"VENUE" | "HISTORICAL_SITE">;
  onEventRolesChange: (roles: Array<"VENUE" | "HISTORICAL_SITE">) => void;
  eventPeriods: string[];
  onEventPeriodsChange: (periods: string[]) => void;
  clubPeriods: string[];
  onClubPeriodsChange: (periods: string[]) => void;
  profileTypes: Array<"USER" | "CLUB">;
  onProfileTypesChange: (types: Array<"USER" | "CLUB">) => void;
  profilePeriods: string[];
  onProfilePeriodsChange: (periods: string[]) => void;
};

const allEntityTypes: MapEntityLocation["entityType"][] = [
  "PROFILE",
  "CLUB",
  "EVENT",
  "SOURCE",
];

/** Type-specific controls stay next to their map layer. Periods are optional:
 * an empty set means include every period, while one or more checked values
 * immediately narrow only that entity type. */
export default function MapEntityFilterControls({
  idPrefix,
  entityTypes,
  onEntityTypesChange,
  from,
  onFromChange,
  to,
  onToChange,
  sourceRoles,
  onSourceRolesChange,
  sourceType,
  onSourceTypeChange,
  sourcePeriods,
  onSourcePeriodsChange,
  eventRoles,
  onEventRolesChange,
  eventPeriods,
  onEventPeriodsChange,
  clubPeriods,
  onClubPeriodsChange,
  profileTypes,
  onProfileTypesChange,
  profilePeriods,
  onProfilePeriodsChange,
}: Props) {
  const toggleEntityType = (type: MapEntityLocation["entityType"]) =>
    onEntityTypesChange(
      entityTypes.includes(type)
        ? entityTypes.filter((value) => value !== type)
        : [...entityTypes, type],
    );
  const toggleSourceRole = (role: SourceLocationRole) =>
    onSourceRolesChange(toggle(sourceRoles, role));
  const toggleEventRole = (role: "VENUE" | "HISTORICAL_SITE") =>
    onEventRolesChange(toggle(eventRoles, role));

  return (
    <div className="map-entity-filter-controls">
      <Form.Group className="map-filter-layers mb-0">
        <Form.Label>Show</Form.Label>
        <div className="map-filter-layer-list">
          {allEntityTypes.map((type) => {
            const label = type[0] + type.slice(1).toLowerCase();

            return (
              <div className="map-filter-layer" key={type}>
                <Form.Check
                  id={`${idPrefix}-type-${type}`}
                  aria-label={`Show ${label}`}
                  checked={entityTypes.includes(type)}
                  onChange={() => toggleEntityType(type)}
                />
                <details className="map-type-filter">
                  <summary>{label}</summary>
                  <div className="map-type-filter-content">
                    {type === "SOURCE" && (
                      <>
                        <Form.Group>
                          <Form.Label>Source place</Form.Label>
                          <div className="d-flex gap-2 flex-wrap">
                            {(
                              [
                                ["DISCOVERED_AT", "Discovered at"],
                                ["HELD_AT", "Held at"],
                              ] as const
                            ).map(([role, roleLabel]) => (
                              <Form.Check
                                inline
                                key={role}
                                id={`${idPrefix}-source-role-${role}`}
                                label={roleLabel}
                                checked={sourceRoles.includes(role)}
                                onChange={() => toggleSourceRole(role)}
                              />
                            ))}
                          </div>
                        </Form.Group>
                        <Form.Group>
                          <Form.Label>Source type</Form.Label>
                          <Form.Select
                            size="sm"
                            value={sourceType}
                            onChange={(event) =>
                              onSourceTypeChange(event.target.value)
                            }
                          >
                            <option value="">All types</option>
                            {TYPES.map((source) => (
                              <option key={source} value={source}>
                                {readable(source)}
                              </option>
                            ))}
                          </Form.Select>
                        </Form.Group>
                        <PeriodFilter idPrefix={idPrefix} entityType={type} periods={sourcePeriods} onChange={onSourcePeriodsChange} />
                      </>
                    )}
                    {type === "EVENT" && (
                      <>
                        <Form.Group>
                          <Form.Label>Event place</Form.Label>
                          <div className="d-flex gap-2 flex-wrap">
                            {(
                              [
                                ["VENUE", "Venue"],
                                ["HISTORICAL_SITE", "Historical site"],
                              ] as const
                            ).map(([role, roleLabel]) => (
                              <Form.Check
                                inline
                                key={role}
                                id={`${idPrefix}-event-role-${role}`}
                                label={roleLabel}
                                checked={eventRoles.includes(role)}
                                onChange={() => toggleEventRole(role)}
                              />
                            ))}
                          </div>
                        </Form.Group>
                        <PeriodFilter idPrefix={idPrefix} entityType={type} periods={eventPeriods} onChange={onEventPeriodsChange} />
                      </>
                    )}
                    {type === "PROFILE" && (
                      <>
                        <Form.Group>
                          <Form.Label>Profile type</Form.Label>
                          <div className="d-flex gap-2 flex-wrap">
                            {(["USER", "CLUB"] as const).map((profileType) => (
                              <Form.Check
                                inline
                                key={profileType}
                                id={`${idPrefix}-profile-type-${profileType}`}
                                label={readable(profileType)}
                                checked={profileTypes.includes(profileType)}
                                onChange={() =>
                                  onProfileTypesChange(toggle(profileTypes, profileType))
                                }
                              />
                            ))}
                          </div>
                        </Form.Group>
                        <PeriodFilter idPrefix={idPrefix} entityType={type} periods={profilePeriods} onChange={onProfilePeriodsChange} />
                      </>
                    )}
                    {type === "CLUB" && (
                      <PeriodFilter idPrefix={idPrefix} entityType={type} periods={clubPeriods} onChange={onClubPeriodsChange} />
                    )}
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      </Form.Group>
      <div className="map-temporal-controls">
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
      </div>
    </div>
  );
}

function PeriodFilter({
  idPrefix,
  entityType,
  periods,
  onChange,
}: {
  idPrefix: string;
  entityType: string;
  periods: string[];
  onChange: (periods: string[]) => void;
}) {
  return (
    <details className="map-period-filter">
      <summary>Period</summary>
      <div className="map-period-filter-content">
        {PERIODS.map((period) => (
          <Form.Check
            key={period}
            id={`${idPrefix}-${entityType.toLowerCase()}-period-${period}`}
            label={readable(period)}
            checked={periods.includes(period)}
            onChange={() => onChange(toggle(periods, period))}
          />
        ))}
      </div>
    </details>
  );
}

function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((candidate) => candidate !== value)
    : [...values, value];
}

function readable(value: string): string {
  return value
    .toLocaleLowerCase()
    .split("_")
    .map((part) => part.slice(0, 1).toLocaleUpperCase() + part.slice(1))
    .join(" ");
}
