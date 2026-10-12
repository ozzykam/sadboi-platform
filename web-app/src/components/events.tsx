"use client";
import { useState } from "react";
import Link from "next/link";
import {
  eventStatuses,
  eventTaskOverdue,
  type EventCalendarEntry,
  type StudioEventRecord,
} from "@sadboi/core";
import { Button, Input, PageHeading } from "./ui";
import { EventCalendar } from "./event-calendar";
import { EventHelp } from "./event-help";
const money = (value: number | null) =>
  value === null
    ? "Not known"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(value / 100);
export function Events({
  events,
  canEdit,
  now,
}: {
  events: StudioEventRecord[];
  canEdit: boolean;
  now: string;
}) {
  const [view, setView] = useState<"todo" | "calendar">("todo"),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [archived, setArchived] = useState(false),
    [closed, setClosed] = useState(false);
  const rows = events.filter(
    (event) =>
      (archived || !event.input.archived) &&
      (status === "all" || event.input.status === status) &&
      [event.input.title, event.input.city, event.input.venue]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const active = rows.filter(
    (event) =>
      !event.input.archived &&
      !["declined", "cancelled"].includes(event.input.status),
  );
  const deadlines = active
    .flatMap((event) =>
      event.input.tasks
        .filter((task) => closed || task.status === "todo")
        .map((task) => ({ event, task, overdue: eventTaskOverdue(task, now) })),
    )
    .sort(
      (a, b) =>
        Number(b.overdue) - Number(a.overdue) ||
        a.task.dueDate.localeCompare(b.task.dueDate) ||
        a.task.dueTime.localeCompare(b.task.dueTime),
    );
  const entries: EventCalendarEntry[] = [
    ...active
      .filter((event) => !!event.input.startDate)
      .map((event) => ({
        id: event.id,
        title: event.input.title,
        date: event.input.startDate,
        endDate: event.input.endDate || event.input.startDate,
        href: `/admin/events/${event.id}`,
        kind: "appearance" as const,
        status: event.input.status,
      })),
    ...deadlines.map(({ event, task }) => ({
      id: `${event.id}:${task.id}`,
      title: `${task.title} · ${event.input.title}`,
      date: task.dueDate,
      endDate: task.dueDate,
      href: `/admin/events/${event.id}#deadline-${task.id}`,
      kind: "deadline" as const,
      status: task.status,
    })),
  ];
  return (
    <div className="events-planner">
      <PageHeading
        eyebrow="STUDIO / EVENTS"
        title="Plan the next appearance."
        description="Track opportunities, applications, fees and the work needed to show up ready."
        action={
          canEdit ? (
            <Link className="button primary" href="/admin/events/new">
              Add event
            </Link>
          ) : undefined
        }
      />
      <p>
        <Link className="inline-link" href="/appearances">
          View public appearances
        </Link>{" "}
        ·{" "}
        <a className="inline-link" href="#events">
          How to plan events
        </a>
      </p>
      {!canEdit && (
        <p className="notice">
          Accounting can review events, deadlines and fees. Super admins make
          changes.
        </p>
      )}
      <div className="inbox-toolbar">
        <Input
          label="Search events"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="field">
          Application / attendance status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All statuses</option>
            {eventStatuses.map((value) => (
              <option value={value} key={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="inbox-check">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />
          Show archived events
        </label>
      </div>
      <div className="inv-actions" role="group" aria-label="Planning display">
        <Button
          aria-pressed={view === "todo"}
          variant={view === "todo" ? "primary" : "secondary"}
          onClick={() => setView("todo")}
        >
          To-do
        </Button>
        <Button
          aria-pressed={view === "calendar"}
          variant={view === "calendar" ? "primary" : "secondary"}
          onClick={() => setView("calendar")}
        >
          Calendar
        </Button>
        <label className="inbox-check">
          <input
            type="checkbox"
            checked={closed}
            onChange={(e) => setClosed(e.target.checked)}
          />
          Show completed/cancelled deadlines
        </label>
      </div>
      <p>
        {deadlines.filter((row) => row.task.status === "todo").length} open
        deadlines · {deadlines.filter((row) => row.overdue).length} overdue.
        Dates use each deadline’s listed time zone.
      </p>
      {view === "calendar" ? (
        <EventCalendar entries={entries} initialMonth={now.slice(0, 7)} />
      ) : (
        <section aria-label="Deadline to-do list">
          <h2>Deadlines and tasks</h2>
          {!deadlines.length ? (
            <p className="empty-state">
              No deadlines match this view. Add an event and its application or
              preparation tasks.
            </p>
          ) : (
            <div className="inbox-table-wrap">
              <table className="inbox-table">
                <caption className="sr-only">Event deadlines and fees</caption>
                <thead>
                  <tr>
                    <th scope="col">Deadline</th>
                    <th scope="col">Event</th>
                    <th scope="col">Due</th>
                    <th scope="col">Fee (USD)</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {deadlines.map(({ event, task, overdue }) => (
                    <tr key={`${event.id}:${task.id}`}>
                      <th scope="row">
                        <Link
                          className="inbox-row-link"
                          href={`/admin/events/${event.id}#deadline-${task.id}`}
                        >
                          {task.title}
                          <small>{task.kind.replaceAll("_", " ")}</small>
                        </Link>
                      </th>
                      <td>{event.input.title}</td>
                      <td>
                        {task.dueDate}
                        {task.dueTime ? ` · ${task.dueTime}` : ""}
                        <small>{task.timezone}</small>
                      </td>
                      <td>
                        {money(task.feeMinor)}
                        <small>
                          {task.feeMinor === 0 ? "Free" : task.feeStatus}
                        </small>
                      </td>
                      <td>
                        <span
                          className={`inbox-status ${overdue ? "event-overdue" : ""}`}
                        >
                          {overdue ? "Overdue" : task.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      <section aria-label="Event opportunities">
        <h2>Events and opportunities</h2>
        {!rows.length && (
          <p className="empty-state">No events match this view.</p>
        )}
        <div className="inbox-table-wrap">
          <table className="inbox-table">
            <caption className="sr-only">
              Event opportunities and publication status
            </caption>
            <thead>
              <tr>
                <th scope="col">Event</th>
                <th scope="col">Dates / location</th>
                <th scope="col">Status</th>
                <th scope="col">Public schedule</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((event) => (
                <tr key={event.id}>
                  <th scope="row">
                    <Link
                      className="inbox-row-link"
                      href={`/admin/events/${event.id}`}
                    >
                      {event.input.title}
                      <small>{event.input.kind.replaceAll("_", " ")}</small>
                    </Link>
                  </th>
                  <td>
                    {event.input.startDate || "Dates unknown"}
                    {event.input.endDate &&
                    event.input.endDate !== event.input.startDate
                      ? ` – ${event.input.endDate}`
                      : ""}
                    <small>
                      {[event.input.venue, event.input.city]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </td>
                  <td>
                    {event.input.status}
                    {event.input.archived ? " · archived" : ""}
                  </td>
                  <td>
                    {event.published
                      ? "Published (upcoming dates only)"
                      : "Private"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <details className="event-help">
        <summary>Planning and publication guide</summary>
        <EventHelp />
      </details>
    </div>
  );
}
