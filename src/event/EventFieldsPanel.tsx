import React from "react";

import EditableDescriptionField from "../component/EditableDescriptionField";
import EditablePeriodSelectorField from "../component/EditablePeriodSelectorField";
import { SaveStatus } from "../component/EditableFieldRow";
import EditableSelectFieldRow from "../component/EditableSelectFieldRow";
import EditableTextFieldRow from "../component/EditableTextFieldRow";
import { HistoricalYearInput } from "../component/HistoricalRangeFilter";
import EditableHistoricalRangeField from "../component/EditableHistoricalRangeField";
import { TempvsEvent } from "./eventApi";

export type EventField =
  | "name"
  | "description"
  | "periods"
  | "kind"
  | "startsAt"
  | "endsAt"
  | "timeZone"
  | "frequency"
  | "interval"
  | "count";

type Props = {
  event: TempvsEvent;
  editable: boolean;
  statuses: Partial<Record<EventField, SaveStatus>>;
  onChange: (field: EventField, value: string | string[]) => void;
  onBlur: (field: EventField) => void;
  onRangeChange?: (from: HistoricalYearInput, to: HistoricalYearInput) => void;
  onRangeBlur?: () => void;
};

function localDateTimeInput(iso: string) {
  const date = new Date(iso);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function displayDateTime(iso: string) {
  return new Date(iso).toLocaleString();
}

/** Event metadata uses the same inline-on-click, save-on-blur fields as clubs. */
export default function EventFieldsPanel({
  event,
  editable,
  statuses,
  onChange,
  onBlur,
  onRangeChange,
  onRangeBlur,
}: Props) {
  const recurrence = event.schedule.recurrence;
  return (
    <section className="club-panel event-info-panel">
      <EditableTextFieldRow
        label="Event name"
        editable={editable}
        value={event.name}
        readOnlyValue={event.name}
        onChange={(input) => onChange("name", input.target.value)}
        onBlur={() => onBlur("name")}
        status={statuses.name}
      />
      <EditableDescriptionField
        editable={editable}
        value={event.description || ""}
        readOnlyValue={event.description || "No description."}
        onValueChange={(value) => onChange("description", value)}
        onBlur={() => onBlur("description")}
        status={statuses.description}
        className="mb-2"
        textClassName="event-description"
        multilineUseContentEditable
      />
      <EditablePeriodSelectorField
        label="Periods"
        editable={editable}
        value={event.periods}
        onChange={(periods) => onChange("periods", periods)}
        onBlur={() => onBlur("periods")}
        status={statuses.periods}
      />
      <EditableHistoricalRangeField
        label="Years"
        editable={editable}
        from={{ year: event.from ? String(event.from.year) : "", era: event.from?.era || "AD" }}
        to={{ year: event.to ? String(event.to.year) : "", era: event.to?.era || "AD" }}
        onFromChange={(from) => onRangeChange?.(from, { year: event.to ? String(event.to.year) : "", era: event.to?.era || "AD" })}
        onToChange={(to) => onRangeChange?.({ year: event.from ? String(event.from.year) : "", era: event.from?.era || "AD" }, to)}
        onBlur={() => onRangeBlur?.()}
        fieldMaxWidth="16rem"
      />
      <EditableTextFieldRow
        label="Status"
        editable={false}
        readOnlyValue={event.isActive ? "Active" : "Inactive"}
      />
      <EditableSelectFieldRow
        label="Schedule"
        editable={editable}
        value={event.schedule.kind}
        readOnlyValue={event.schedule.kind === "RECURRING" ? "Recurring" : "One-time"}
        options={[
          { value: "ONE_TIME", label: "One-time" },
          { value: "RECURRING", label: "Recurring" },
        ]}
        onChange={(input) => onChange("kind", input.target.value)}
        onBlur={() => onBlur("kind")}
        status={statuses.kind}
      />
      <EditableTextFieldRow
        label="Starts"
        editable={editable}
        type="datetime-local"
        value={localDateTimeInput(event.schedule.startsAt)}
        readOnlyValue={displayDateTime(event.schedule.startsAt)}
        onChange={(input) => onChange("startsAt", input.target.value)}
        onBlur={() => onBlur("startsAt")}
        status={statuses.startsAt}
      />
      <EditableTextFieldRow
        label="Ends"
        editable={editable}
        type="datetime-local"
        value={localDateTimeInput(event.schedule.endsAt)}
        readOnlyValue={displayDateTime(event.schedule.endsAt)}
        onChange={(input) => onChange("endsAt", input.target.value)}
        onBlur={() => onBlur("endsAt")}
        status={statuses.endsAt}
      />
      <EditableSelectFieldRow
        label="Time zone"
        editable={editable}
        value={event.schedule.timeZone}
        readOnlyValue={event.schedule.timeZone}
        options={[
          "UTC",
          "America/New_York",
          "Europe/London",
          "Europe/Prague",
          "Europe/Warsaw",
        ].map((value) => ({ value, label: value }))}
        onChange={(input) => onChange("timeZone", input.target.value)}
        onBlur={() => onBlur("timeZone")}
        status={statuses.timeZone}
      />
      {event.schedule.kind === "RECURRING" && (
        <>
          <EditableSelectFieldRow
            label="Repeats"
            editable={editable}
            value={recurrence?.frequency || "WEEKLY"}
            readOnlyValue={`Every ${recurrence?.interval || 1} ${(recurrence?.frequency || "WEEKLY").toLowerCase()}.`}
            options={["DAILY", "WEEKLY", "MONTHLY"].map((value) => ({ value, label: value[0] + value.slice(1).toLowerCase() }))}
            onChange={(input) => onChange("frequency", input.target.value)}
            onBlur={() => onBlur("frequency")}
            status={statuses.frequency}
          />
          <EditableTextFieldRow
            label="Every"
            editable={editable}
            type="number"
            value={recurrence?.interval || 1}
            readOnlyValue={String(recurrence?.interval || 1)}
            onChange={(input) => onChange("interval", input.target.value)}
            onBlur={() => onBlur("interval")}
            status={statuses.interval}
          />
          <EditableTextFieldRow
            label="Occurrences"
            editable={editable}
            type="number"
            value={recurrence?.count || 1}
            readOnlyValue={String(recurrence?.count || 1)}
            onChange={(input) => onChange("count", input.target.value)}
            onBlur={() => onBlur("count")}
            status={statuses.count}
          />
        </>
      )}
      <h2 className="event-occurrences-heading">Occurrences</h2>
      <ul className="event-occurrences">
        {(event.upcomingOccurrences || []).map((occurrence) => (
          <li key={occurrence.id}>
            <time>{displayDateTime(occurrence.startsAt)}</time>
            <span>{occurrence.status}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
