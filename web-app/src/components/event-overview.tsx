import type { StudioEventRecord } from "@sadboi/core";
import { Badge, Button } from "./ui";

const label = (value: string) =>
  value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
const date = (value: string) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${value}T12:00:00Z`))
    : "Dates to be announced";
const money = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    value / 100,
  );

export function EventOverview({
  record,
  onEdit,
}: {
  record: StudioEventRecord;
  onEdit?: (target: string) => void;
}) {
  const event = record.input;
  const open = event.tasks
    .filter((task) => task.status === "todo")
    .sort(
      (a, b) =>
        a.dueDate.localeCompare(b.dueDate) ||
        a.dueTime.localeCompare(b.dueTime),
    );
  const completed = event.tasks.filter((task) => task.status === "done").length;
  const tasks = [
    ...open,
    ...event.tasks.filter((task) => task.status !== "todo"),
  ];
  return (
    <div className="event-overview">
      <div className="event-overview-badges" aria-label="Event status">
        <Badge tone={event.status === "confirmed" ? "green" : "neutral"}>
          {label(event.status)}
        </Badge>
        <Badge tone={record.published ? "green" : "gold"}>
          {record.published ? "Published appearance" : "Private appearance"}
        </Badge>
        {event.archived && <Badge>Archived</Badge>}
        <span>{label(event.kind)}</span>
      </div>
      <dl className="event-overview-facts">
        <div>
          <dt>When</dt>
          <dd>
            {date(event.startDate)}
            {event.endDate && event.endDate !== event.startDate
              ? ` – ${date(event.endDate)}`
              : ""}
          </dd>
          <dd className="event-overview-secondary">
            {[event.startTime, event.endTime].filter(Boolean).join(" – ") ||
              "Times to be announced"}{" "}
            · {event.timezone}
          </dd>
        </div>
        <div>
          <dt>Where</dt>
          <dd>{event.venue || "Venue to be announced"}</dd>
          <dd className="event-overview-secondary">
            {[event.address, event.city, event.region, event.country]
              .filter(Boolean)
              .join(", ")}
          </dd>
          {event.booth && (
            <dd className="event-overview-secondary">
              Booth / meeting point: {event.booth}
            </dd>
          )}
        </div>
        <div>
          <dt>Next to-do</dt>
          <dd>
            {open[0] ? (
              <a className="inline-link" href={`#deadline-${open[0].id}`}>
                {open[0].title}
              </a>
            ) : (
              "No open to-dos"
            )}
          </dd>
          <dd className="event-overview-secondary">
            {open[0] ? `Due ${date(open[0].dueDate)}` : "All clear"}
          </dd>
        </div>
      </dl>
      <div className="event-overview-layout">
        <div>
          <section
            className="event-overview-section"
            aria-labelledby="event-todos-title"
          >
            <div className="event-section-heading">
              <div>
                <h2 id="event-todos-title">To-do items</h2>
                <p className="event-overview-secondary">
                  {open.length} open · {completed} completed ·{" "}
                  {event.tasks.length} total
                </p>
              </div>
              {onEdit && (
                <Button
                  variant="secondary"
                  onClick={() => onEdit("event-edit-tasks")}
                >
                  Edit to-dos
                </Button>
              )}
            </div>
            {!tasks.length && (
              <p className="empty-state">
                No to-dos yet. Add application deadlines, booth payments or
                preparation tasks using Edit to-dos.
              </p>
            )}
            <ul className="event-overview-tasks">
              {tasks.map((task) => (
                <li
                  key={task.id}
                  id={`deadline-${task.id}`}
                  className="event-overview-task"
                >
                  <div className="event-section-heading">
                    <span className="event-overview-secondary">
                      {label(task.kind)}
                    </span>
                    <Badge
                      tone={
                        task.status === "done"
                          ? "green"
                          : task.status === "todo"
                            ? "gold"
                            : "neutral"
                      }
                    >
                      {task.status === "todo" ? "To do" : label(task.status)}
                    </Badge>
                  </div>
                  <div className="event-section-heading">
                    <h3>{task.title}</h3>
                    {onEdit && (
                      <Button
                        variant="ghost"
                        aria-label={`Edit to-do: ${task.title}`}
                        onClick={() => onEdit(`deadline-${task.id}`)}
                      >
                        Edit
                      </Button>
                    )}
                  </div>
                  <p className="event-task-due">
                    Due {date(task.dueDate)}
                    {task.dueTime ? ` at ${task.dueTime}` : ""}{" "}
                    <span className="event-overview-secondary">
                      · {task.timezone}
                    </span>
                  </p>
                  {task.details && (
                    <p className="preserve-lines">{task.details}</p>
                  )}
                  <div className="event-task-fee">
                    <strong>
                      {task.feeMinor === null
                        ? "Fee not entered"
                        : task.feeMinor === 0
                          ? "No fee"
                          : money(task.feeMinor)}
                    </strong>
                    <span>
                      {task.feeStatus === "paid"
                        ? "Paid externally"
                        : task.feeStatus === "waived"
                          ? "Waived"
                          : task.feeMinor
                            ? "Not recorded paid"
                            : ""}
                    </span>
                  </div>
                  {task.feeReference && (
                    <p className="event-overview-secondary">
                      Receipt / reference: {task.feeReference}
                    </p>
                  )}
                  {record.completionDates[task.id] && (
                    <p className="event-overview-secondary">
                      Completed{" "}
                      {new Intl.DateTimeFormat("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: task.timezone,
                      }).format(new Date(record.completionDates[task.id]))}{" "}
                      · {task.timezone}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
          <section
            className="event-overview-section"
            aria-labelledby="event-description-title"
          >
            <h2 id="event-description-title">About the appearance</h2>
            <p className="preserve-lines">
              {event.publicDescription || "No public description yet."}
            </p>
            {event.eventUrl && (
              <a
                className="inline-link"
                href={event.eventUrl}
                target="_blank"
                rel="noreferrer"
              >
                Visit event website ↗
              </a>
            )}
          </section>
        </div>
        <aside
          className="event-overview-section"
          aria-labelledby="event-planning-title"
        >
          <p className="eyebrow">STAFF ONLY</p>
          <h2 id="event-planning-title">Application & planning</h2>
          <dl className="event-planning-facts">
            <div>
              <dt>Organizer</dt>
              <dd>{event.organizer || "Not added"}</dd>
              {event.organizerEmail && (
                <dd>
                  <a
                    className="inline-link"
                    href={`mailto:${event.organizerEmail}`}
                  >
                    {event.organizerEmail}
                  </a>
                </dd>
              )}
            </div>
            <div>
              <dt>Application</dt>
              <dd>
                {event.applicationUrl ? (
                  <a
                    className="inline-link"
                    href={event.applicationUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open application ↗
                  </a>
                ) : (
                  "No application link added"
                )}
              </dd>
            </div>
          </dl>
          <h3>Planning notes</h3>
          <p className="preserve-lines">
            {event.notes || "No private notes yet."}
          </p>
          <p className="event-overview-secondary">
            Planning notes, organizer details, to-dos and fees stay private.
          </p>
        </aside>
      </div>
    </div>
  );
}
