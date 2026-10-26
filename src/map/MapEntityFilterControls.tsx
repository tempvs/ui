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
  eventRoles: Array<"VENUE" | "HISTORICAL_SITE">;
  onEventRolesChange: (roles: Array<"VENUE" | "HISTORICAL_SITE">) => void;
  includePastEvents: boolean;
  onIncludePastEventsChange: (includePast: boolean) => void;
  profileTypes: Array<"USER" | "CLUB">;
  onProfileTypesChange: (types: Array<"USER" | "CLUB">) => void;
  periods: string[];
  onPeriodsChange: (periods: string[]) => void;
  periodsEnabled: boolean;
  onPeriodsEnabledChange: (enabled: boolean) => void;
};

const allEntityTypes: MapEntityLocation["entityType"][] = [
  "PROFILE",
  "CLUB",
  "EVENT",
  "SOURCE",
];

/** Type-specific controls stay next to their map layer. The shared period
 * control can be paused while retaining selections; choosing a period enables
 * it immediately. */
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
  eventRoles,
  onEventRolesChange,
  includePastEvents,
  onIncludePastEventsChange,
  profileTypes,
  onProfileTypesChange,
  periods,
  onPeriodsChange,
  periodsEnabled,
  onPeriodsEnabledChange,
}: Props) {
  const [openDisclosure, setOpenDisclosure] = React.useState<string | null>(
    null,
  );
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
      <div className="map-layer-filter-stack">
        <Form.Group className="map-filter-layers mb-0">
          <Form.Label>Show</Form.Label>
          <div className="map-filter-layer-list">
            {allEntityTypes.map((type) => {
              const label = type[0] + type.slice(1).toLowerCase();
              const hasTypeControls = type !== "CLUB";

              return (
                <div className="map-filter-layer" key={type}>
                  <Form.Check
                    id={`${idPrefix}-type-${type}`}
                    aria-label={`Show ${label}`}
                    checked={entityTypes.includes(type)}
                    onChange={() => toggleEntityType(type)}
                  />
                  {hasTypeControls ? (
                    <details
                      className="map-type-filter"
                      open={openDisclosure === type}
                    >
                      <summary
                        onClick={(event) => {
                          event.preventDefault();
                          setOpenDisclosure((current) =>
                            current === type ? null : type,
                          );
                        }}
                      >
                        {label}
                      </summary>
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
                            <Form.Check
                              id={`${idPrefix}-event-include-past`}
                              label="Include past events"
                              checked={includePastEvents}
                              onChange={(event) =>
                                onIncludePastEventsChange(event.target.checked)
                              }
                            />
                          </>
                        )}
                        {type === "PROFILE" && (
                          <Form.Group>
                            <Form.Label>Profile type</Form.Label>
                            <div className="d-flex gap-2 flex-wrap">
                              {(["USER", "CLUB"] as const).map(
                                (profileType) => (
                                  <Form.Check
                                    inline
                                    key={profileType}
                                    id={`${idPrefix}-profile-type-${profileType}`}
                                    label={readable(profileType)}
                                    checked={profileTypes.includes(profileType)}
                                    onChange={() =>
                                      onProfileTypesChange(
                                        toggle(profileTypes, profileType),
                                      )
                                    }
                                  />
                                ),
                              )}
                            </div>
                          </Form.Group>
                        )}
                      </div>
                    </details>
                  ) : (
                    <span className="map-type-filter-label map-type-filter-label--placeholder">
                      {label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </Form.Group>
      </div>
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
        <PeriodFilter
          idPrefix={idPrefix}
          periods={periods}
          onChange={(nextPeriods) => {
            onPeriodsChange(nextPeriods);
            if (nextPeriods.length) onPeriodsEnabledChange(true);
          }}
          enabled={periodsEnabled}
          onEnabledChange={onPeriodsEnabledChange}
          open={openDisclosure === "PERIOD"}
          onToggle={() =>
            setOpenDisclosure((current) =>
              current === "PERIOD" ? null : "PERIOD",
            )
          }
        />
      </div>
    </div>
  );
}

function PeriodFilter({
  idPrefix,
  periods,
  onChange,
  enabled,
  onEnabledChange,
  open,
  onToggle,
}: {
  idPrefix: string;
  periods: string[];
  onChange: (periods: string[]) => void;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="map-period-filter-row">
      <Form.Check
        id={`${idPrefix}-period-filter-enabled`}
        aria-label="Enable period filter"
        checked={enabled}
        onChange={(event) => onEnabledChange(event.target.checked)}
        className="mb-0"
      />
      <details
        className="map-period-filter map-period-filter--global"
        open={open}
      >
        <summary
          onClick={(event) => {
            event.preventDefault();
            onToggle();
          }}
        >
          Period
        </summary>
        <div className="map-period-filter-content">
          {PERIODS.map((period) => (
            <Form.Check
              key={period}
              id={`${idPrefix}-period-${period}`}
              label={readable(period)}
              checked={periods.includes(period)}
              onChange={() => onChange(toggle(periods, period))}
            />
          ))}
        </div>
      </details>
    </div>
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
