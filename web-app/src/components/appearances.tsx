"use client";
import { useState } from "react";
import type { Appearance, PublicAppearance } from "@sadboi/core";
import { EventCalendar } from "./event-calendar";
import { Button } from "./ui";
export function AppearanceCard({
  appearance,
  id,
}: {
  appearance: Appearance;
  id?: string;
}) {
  return (
    <article className="appearance-card" id={id}>
      <div className="appearance-date">
        <time dateTime={appearance.startDate}>
          {appearance.startDate || "Dates to be announced"}
        </time>
        {appearance.endDate && appearance.endDate !== appearance.startDate && (
          <>
            <span>through</span>
            <time dateTime={appearance.endDate}>{appearance.endDate}</time>
          </>
        )}
      </div>
      <div>
        <p className="eyebrow">{appearance.kind.replaceAll("_", " ")}</p>
        <h2>{appearance.title}</h2>
        <p>
          <strong>{appearance.venue || "Venue to be announced"}</strong>
          {appearance.address ? ` · ${appearance.address}` : ""}
        </p>
        <p>
          {[appearance.city, appearance.region, appearance.country]
            .filter(Boolean)
            .join(", ")}
        </p>
        <p>
          {appearance.startTime
            ? `Starts ${appearance.startDate} at ${appearance.startTime}`
            : "Start time to be announced"}
          {appearance.endTime
            ? ` · Ends ${appearance.endDate} at ${appearance.endTime}`
            : ""}{" "}
          · {appearance.timezone}
        </p>
        {appearance.booth && (
          <p>
            <strong>Find Sadboi:</strong> {appearance.booth}
          </p>
        )}
        <p className="preserve-lines">{appearance.publicDescription}</p>
        {appearance.eventUrl && (
          <a
            className="inline-link"
            href={appearance.eventUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Event details / tickets ↗
          </a>
        )}
      </div>
    </article>
  );
}
export function Appearances({
  appearances,
  initialMonth,
}: {
  appearances: PublicAppearance[];
  initialMonth: string;
}) {
  const [view, setView] = useState<"schedule" | "calendar">("schedule");
  return (
    <main className="appearances-page">
      <p className="eyebrow">SADBOI / OUT IN THE WORLD</p>
      <h1>Come say hello.</h1>
      <p className="subtitle">
        Find Sadboi at upcoming markets, conventions, festivals and other
        appearances. Stop by, explore the artwork and meet the artist.
      </p>
      <div className="inv-actions" role="group" aria-label="Appearance display">
        <Button
          variant={view === "schedule" ? "primary" : "secondary"}
          aria-pressed={view === "schedule"}
          onClick={() => setView("schedule")}
        >
          Schedule
        </Button>
        <Button
          variant={view === "calendar" ? "primary" : "secondary"}
          aria-pressed={view === "calendar"}
          onClick={() => setView("calendar")}
        >
          Calendar
        </Button>
      </div>
      {!appearances.length && (
        <p className="empty-state">
          No upcoming appearances announced yet. Check back for the next chance
          to meet Sadboi.
        </p>
      )}
      {view === "calendar" && (
        <EventCalendar
          initialMonth={initialMonth}
          entries={appearances.map((appearance) => ({
            id: appearance.id,
            title: appearance.title,
            date: appearance.startDate,
            endDate: appearance.endDate,
            href: `#appearance-${appearance.id}`,
            kind: "appearance",
          }))}
        />
      )}
      <section aria-label="Upcoming appearances">
        {appearances.map((appearance) => (
          <AppearanceCard
            key={appearance.id}
            appearance={appearance}
            id={`appearance-${appearance.id}`}
          />
        ))}
      </section>
    </main>
  );
}
