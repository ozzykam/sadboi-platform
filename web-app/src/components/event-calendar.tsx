"use client";
import { useState } from "react";
import Link from "next/link";
import { eventCalendarDays, type EventCalendarEntry } from "@sadboi/core";
import { Button, Input } from "./ui";
export function EventCalendar({
  entries,
  initialMonth,
}: {
  entries: EventCalendarEntry[];
  initialMonth: string;
}) {
  const [month, setMonth] = useState(initialMonth);
  function move(direction: number) {
    const date = new Date(`${month}-01T12:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + direction);
    setMonth(date.toISOString().slice(0, 7));
  }
  const label = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T12:00:00Z`));
  const days = eventCalendarDays(month),
    rows = Array.from({ length: 6 }, (_, index) =>
      days.slice(index * 7, index * 7 + 7),
    );
  return (
    <section className="event-calendar" aria-label="Monthly event calendar">
      <div className="event-calendar-toolbar">
        <Button variant="secondary" onClick={() => move(-1)}>
          Previous month
        </Button>
        <Input
          label="Calendar month"
          type="month"
          value={month}
          onChange={(e) => {
            if (/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value))
              setMonth(e.target.value);
          }}
        />
        <Button variant="secondary" onClick={() => move(1)}>
          Next month
        </Button>
      </div>
      <p aria-live="polite">
        {label}. Dates and times use each event or deadline’s listed time zone.
      </p>
      <div
        className="event-calendar-scroll"
        tabIndex={0}
        role="region"
        aria-label={`${label} calendar; scroll horizontally on small screens`}
      >
        <table>
          <caption className="sr-only">{label}</caption>
          <thead>
            <tr>
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <th key={day} scope="col">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((week, index) => (
              <tr key={index}>
                {week.map((date) => (
                  <td
                    key={date}
                    className={
                      date.startsWith(month) ? "" : "event-calendar-outside"
                    }
                  >
                    <time dateTime={date}>{Number(date.slice(8))}</time>
                    <ul>
                      {entries
                        .filter(
                          (entry) =>
                            entry.date <= date &&
                            (entry.endDate || entry.date) >= date,
                        )
                        .map((entry) => (
                          <li key={entry.id}>
                            <Link
                              href={entry.href}
                              className={`calendar-${entry.kind}`}
                            >
                              {entry.kind === "deadline" ? "Due: " : ""}
                              {entry.title}
                              {entry.status
                                ? ` · ${entry.status.replaceAll("_", " ")}`
                                : ""}
                            </Link>
                          </li>
                        ))}
                    </ul>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!entries.some(
        (entry) =>
          entry.date <= `${month}-31` &&
          (entry.endDate || entry.date) >= `${month}-01`,
      ) && <p className="empty-state">Nothing scheduled this month.</p>}
    </section>
  );
}
