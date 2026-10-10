import React from "react";
import { Form } from "react-bootstrap";

import HistoricalRangeFilter, {
  type HistoricalYearInput,
} from "../component/HistoricalRangeFilter";
import { CLASSIFICATIONS, PERIODS, TYPES } from "../library/libraryShared";
import type {
  MapEntityLocation,
  SourceLocationRole,
} from "./mapApi";

type Props = {
  idPrefix: string;
  entityTypes: MapEntityLocation["entityType"][];
  onEntityTypesChange: (types: MapEntityLocation["entityType"][]) => void;
  sourceRoles: SourceLocationRole[];
  onSourceRolesChange: (roles: SourceLocationRole[]) => void;
  sourcePeriod: string;
  onSourcePeriodChange: (value: string) => void;
  sourceClassification: string;
  onSourceClassificationChange: (value: string) => void;
  sourceType: string;
  onSourceTypeChange: (value: string) => void;
  sourceFrom: HistoricalYearInput;
  onSourceFromChange: (value: HistoricalYearInput) => void;
  sourceTo: HistoricalYearInput;
  onSourceToChange: (value: HistoricalYearInput) => void;
  eventPeriod: string;
  onEventPeriodChange: (value: string) => void;
  eventFrom: HistoricalYearInput;
  onEventFromChange: (value: HistoricalYearInput) => void;
  eventTo: HistoricalYearInput;
  onEventToChange: (value: HistoricalYearInput) => void;
  compact?: boolean;
};

const allEntityTypes: MapEntityLocation["entityType"][] = [
  "PROFILE",
  "CLUB",
  "EVENT",
  "SOURCE",
];

/** Shared public-marker filters for the full map and compact location maps.
 * Source facets intentionally affect only SOURCE markers; profiles, clubs,
 * and events stay visible when selected beside a source refinement. */
export default function MapEntityFilterControls({
  idPrefix,
  entityTypes,
  onEntityTypesChange,
  sourceRoles,
  onSourceRolesChange,
  sourcePeriod,
  onSourcePeriodChange,
  sourceClassification,
  onSourceClassificationChange,
  sourceType,
  onSourceTypeChange,
  sourceFrom,
  onSourceFromChange,
  sourceTo,
  onSourceToChange,
  eventPeriod,
  onEventPeriodChange,
  eventFrom,
  onEventFromChange,
  eventTo,
  onEventToChange,
  compact = false,
}: Props) {
  const groupClass = compact ? "mb-2" : undefined;
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

  return (
    <>
      <Form.Group className={groupClass}>
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
      {entityTypes.includes("SOURCE") && (
        <>
          <Form.Group className={groupClass}>
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
          <Form.Group className={groupClass}>
            <Form.Label>Source period</Form.Label>
            <Form.Select
              size={compact ? "sm" : undefined}
              value={sourcePeriod}
              onChange={(event) => onSourcePeriodChange(event.target.value)}
            >
              <option value="">All periods</option>
              {PERIODS.map((period) => (
                <option key={period} value={period}>
                  {readable(period)}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <HistoricalRangeFilter
            label="Source years"
            enabled={false}
            showToggle={false}
            alwaysShowFields
            from={sourceFrom}
            to={sourceTo}
            onEnabledChange={() => undefined}
            onFromChange={onSourceFromChange}
            onToChange={onSourceToChange}
            className={groupClass}
            compact={compact}
          />
          <Form.Group className={groupClass}>
            <Form.Label>Classification</Form.Label>
            <Form.Select
              size={compact ? "sm" : undefined}
              value={sourceClassification}
              onChange={(event) =>
                onSourceClassificationChange(event.target.value)
              }
            >
              <option value="">All classifications</option>
              {CLASSIFICATIONS.map((classification) => (
                <option key={classification} value={classification}>
                  {readable(classification)}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group className={groupClass}>
            <Form.Label>Source type</Form.Label>
            <Form.Select
              size={compact ? "sm" : undefined}
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
        <>
          <Form.Group className={groupClass}>
            <Form.Label>Event period</Form.Label>
            <Form.Select
              size={compact ? "sm" : undefined}
              value={eventPeriod}
              onChange={(event) => onEventPeriodChange(event.target.value)}
            >
              <option value="">All periods</option>
              {PERIODS.map((period) => (
                <option key={period} value={period}>
                  {readable(period)}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <HistoricalRangeFilter
            label="Event years"
            enabled={false}
            showToggle={false}
            alwaysShowFields
            from={eventFrom}
            to={eventTo}
            onEnabledChange={() => undefined}
            onFromChange={onEventFromChange}
            onToChange={onEventToChange}
            className={groupClass}
            compact={compact}
          />
        </>
      )}
    </>
  );
}

function readable(value: string): string {
  return value
    .toLocaleLowerCase()
    .split("_")
    .map((part) => part.slice(0, 1).toLocaleUpperCase() + part.slice(1))
    .join(" ");
}
