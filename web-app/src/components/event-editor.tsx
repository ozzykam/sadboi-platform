"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  appearanceSchema,
  eventAppearance,
  eventKinds,
  eventStatuses,
  eventTaskKinds,
  parseCommissionBudget,
  studioEventCommandSchema,
  type StudioEventCommand,
  type StudioEventInput,
  type EventTask,
} from "@sadboi/core";
import type { eventDetail } from "@/server/events";
import {
  inventoryRequest,
  InventoryRequestError,
} from "@/lib/inventory-client";
import { Button, Input, PageHeading, Textarea } from "./ui";
import { AppearanceCard } from "./appearances";
import { EventHelp } from "./event-help";
import { EventOverview } from "./event-overview";
type Detail = Awaited<ReturnType<typeof eventDetail>>;
const blank: StudioEventInput = {
  title: "",
  kind: "convention",
  status: "considering",
  archived: false,
  startDate: "",
  endDate: "",
  startTime: "",
  endTime: "",
  timezone: "America/Chicago",
  venue: "",
  address: "",
  city: "",
  region: "",
  country: "United States",
  booth: "",
  publicDescription: "",
  eventUrl: "",
  organizer: "",
  organizerEmail: "",
  applicationUrl: "",
  notes: "",
  tasks: [],
};
const feeValues = (input: StudioEventInput) =>
  Object.fromEntries(
    input.tasks.map((task) => [
      task.id,
      task.feeMinor === null ? "" : (task.feeMinor / 100).toFixed(2),
    ]),
  );
const words = (value: string) => value.replaceAll("_", " ");
export function EventEditor({
  id,
  initial,
  canEdit,
}: {
  id: string;
  initial: Detail | null;
  canEdit: boolean;
}) {
  const [detail, setDetail] = useState(initial),
    [input, setInput] = useState(initial?.record.input ?? blank),
    [fees, setFees] = useState<Record<string, string>>(
      feeValues(initial?.record.input ?? blank),
    );
  const [note, setNote] = useState(""),
    [editing, setEditing] = useState(!initial && canEdit),
    [editTarget, setEditTarget] = useState(""),
    [discarding, setDiscarding] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState<StudioEventCommand | null>(null);
  const lock = useRef(false),
    record = detail?.record,
    frozen = busy || !!pending,
    capped = (record?.revision ?? 0) >= 200,
    disabled = frozen || capped || !canEdit;
  const dirty =
    JSON.stringify(input) !== JSON.stringify(record?.input ?? blank) ||
    JSON.stringify(fees) !== JSON.stringify(feeValues(record?.input ?? blank));
  const key = `sadboi-event-pending:${id}`;
  const preview = appearanceSchema.safeParse(eventAppearance(input));
  useEffect(() => {
    if (!editTarget) return;
    const target = document.getElementById(editTarget);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "start" });
  }, [editing, editTarget]);
  function edit(target = "event-edit-heading") {
    setEditing(true);
    setEditTarget(target);
    setMessage("");
    setDiscarding(false);
  }
  function closeEditor() {
    if (detail) loaded(detail);
    setEditing(false);
    setDiscarding(false);
    setEditTarget("event-view-heading");
  }
  const patch = (values: Partial<StudioEventInput>) =>
    setInput({ ...input, ...values });
  const patchTask = (taskId: string, values: Partial<EventTask>) =>
    patch({
      tasks: input.tasks.map((task) =>
        task.id === taskId ? { ...task, ...values } : task,
      ),
    });
  function remember(command: StudioEventCommand | null) {
    setPending(command);
    try {
      if (command) sessionStorage.setItem(key, JSON.stringify(command));
      else sessionStorage.removeItem(key);
    } catch {
      /* The mounted page retains the pending request. */
    }
  }
  function recovered() {
    try {
      const parsed = studioEventCommandSchema.safeParse(
        JSON.parse(sessionStorage.getItem(key) ?? "null"),
      );
      return parsed.success && parsed.data.id === id ? parsed.data : null;
    } catch {
      return null;
    }
  }
  function loaded(value: Detail) {
    setDetail(value);
    setInput(value.record.input);
    setFees(feeValues(value.record.input));
    setNote("");
  }
  async function reload() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      loaded(await inventoryRequest(`/api/events?id=${id}`));
      setMessage("Loaded saved event. Unsaved changes were discarded.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function save(command: StudioEventCommand) {
    const previous = recovered();
    if (previous && previous.operationId !== command.operationId) {
      setPending(previous);
      setMessage("An earlier event action needs confirmation. Retry it first.");
      return;
    }
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    remember(command);
    setMessage("");
    try {
      await inventoryRequest("/api/events", {
        method: "POST",
        body: JSON.stringify(command),
      });
      const next: Detail = await inventoryRequest(`/api/events?id=${id}`);
      const removed = !!record?.published && !next.record.published;
      loaded(next);
      remember(null);
      setEditing(false);
      setDiscarding(false);
      setEditTarget("event-view-heading");
      setMessage(
        command.action === "publish"
          ? "Appearance published to the public schedule."
          : command.action === "unpublish" || removed
            ? "Event saved. The appearance is now private; review and publish it again when ready."
            : "Event saved with history.",
      );
    } catch (error) {
      if (
        error instanceof InventoryRequestError &&
        [400, 403, 404, 409, 413].includes(error.status)
      )
        remember(null);
      setMessage((error as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function action(action: StudioEventCommand["action"]) {
    try {
      const parsed = studioEventCommandSchema.safeParse({
        action,
        id,
        operationId: crypto.randomUUID(),
        expectedRevision: record?.revision ?? 0,
        note,
        ...(action === "save"
          ? {
              input: {
                ...input,
                tasks: input.tasks.map((task) => ({
                  ...task,
                  feeMinor: parseCommissionBudget(fees[task.id] ?? ""),
                })),
              },
            }
          : {}),
      });
      if (!parsed.success) {
        setMessage(
          parsed.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join(" "),
        );
        return;
      }
      void save(parsed.data);
    } catch (error) {
      setMessage((error as Error).message);
    }
  }
  return (
    <div className="event-editor">
      <PageHeading
        eyebrow="STUDIO / EVENT PLANNING"
        title={record?.input.title ?? "New event opportunity"}
        description="Plan privately, then publish the confirmed appearance when it is ready to share."
        action={
          record && canEdit && !editing ? (
            <Button disabled={disabled} onClick={() => edit()}>
              Edit event
            </Button>
          ) : undefined
        }
      />
      <p>
        <Link href="/admin/events" className="inline-link">
          All events and deadlines
        </Link>{" "}
        ·{" "}
        <Link href="/appearances" className="inline-link">
          Public appearances
        </Link>{" "}
        ·{" "}
        <a href="#events" className="inline-link">
          How to plan events
        </a>
      </p>
      {!canEdit && (
        <p className="notice">
          Accounting can review event details and history. Super admins make
          changes.
        </p>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {record && !editing && (
        <div id="event-view-heading" tabIndex={-1}>
          <EventOverview
            record={record}
            onEdit={canEdit && !disabled ? edit : undefined}
          />
        </div>
      )}
      {editing && (
        <div className="event-edit-toolbar">
          <h2 id="event-edit-heading" tabIndex={-1}>
            {record ? "Edit event" : "Create event"}
          </h2>
          {record && (
            <Button
              variant="secondary"
              disabled={frozen}
              onClick={() =>
                dirty || note ? setDiscarding(true) : closeEditor()
              }
            >
              Cancel editing
            </Button>
          )}
          {discarding && (
            <div className="notice" role="alert">
              <p>Discard your unsaved changes and return to the overview?</p>
              <div className="inv-actions">
                <Button variant="secondary" onClick={closeEditor}>
                  Discard changes
                </Button>
                <Button variant="ghost" onClick={() => setDiscarding(false)}>
                  Keep editing
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
      <details className="event-help" open={pending ? true : undefined}>
        <summary>Saved record and recovery</summary>
        <div className="inv-actions">
          {record && (
            <Button
              variant="secondary"
              disabled={frozen}
              onClick={() => void reload()}
            >
              Reload event
            </Button>
          )}
          {canEdit && (
            <Button
              variant="ghost"
              disabled={frozen}
              onClick={() => {
                const command = recovered();
                if (command) {
                  setPending(command);
                  setMessage(
                    `Recovered ${command.action}. Review and retry the original request.`,
                  );
                } else
                  setMessage(
                    "No interrupted event action was found in this tab.",
                  );
              }}
            >
              Recover interrupted action
            </Button>
          )}
          {pending && (
            <Button disabled={busy} onClick={() => void save(pending)}>
              Retry same event action
            </Button>
          )}
        </div>
        {record && (
          <p>
            Last saved: {record.updatedAt} ·{" "}
            {record.published
              ? "Published (current and upcoming dates only)"
              : "Private"}{" "}
            · Revision {record.revision}
          </p>
        )}
      </details>
      {pending && (
        <p>
          Pending action: {pending.action} · {pending.note}
        </p>
      )}
      {capped && (
        <p className="notice">
          The 200-change history limit has been reached. Contact an
          administrator before further updates.
        </p>
      )}
      {editing && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            action("save");
          }}
        >
          <fieldset disabled={disabled} className="event-fields">
            <legend>Event and attendance</legend>
            <Input
              label="Event name"
              required
              minLength={3}
              maxLength={180}
              value={input.title}
              onChange={(e) => patch({ title: e.target.value })}
            />
            <div className="field-grid">
              <label className="field">
                Event type
                <select
                  value={input.kind}
                  onChange={(e) =>
                    patch({ kind: e.target.value as StudioEventInput["kind"] })
                  }
                >
                  {eventKinds.map((kind) => (
                    <option value={kind} key={kind}>
                      {words(kind)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Application / attendance status
                <select
                  value={input.status}
                  onChange={(e) =>
                    patch({
                      status: e.target.value as StudioEventInput["status"],
                    })
                  }
                >
                  {eventStatuses.map((status) => (
                    <option value={status} key={status}>
                      {words(status)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p>
              Confirmed means Sadboi’s attendance is confirmed. Publishing is a
              separate action after saving.
            </p>
            <label className="inbox-check">
              <input
                type="checkbox"
                checked={input.archived}
                onChange={(e) => patch({ archived: e.target.checked })}
              />
              Archive event
            </label>
          </fieldset>
          <fieldset disabled={disabled} className="event-fields">
            <legend>Appearance details — public only when published</legend>
            <p>
              Dates may remain blank while researching. Both start and end dates
              are required for publication; for a one-day event, use the same
              date.
            </p>
            <div className="field-grid">
              <Input
                label="Event start date"
                type="date"
                value={input.startDate}
                onChange={(e) => patch({ startDate: e.target.value })}
              />
              <Input
                label="Event end date"
                type="date"
                value={input.endDate}
                onChange={(e) => patch({ endDate: e.target.value })}
              />
              <Input
                label="Start time (optional)"
                type="time"
                value={input.startTime}
                onChange={(e) => patch({ startTime: e.target.value })}
              />
              <Input
                label="End time (optional)"
                type="time"
                value={input.endTime}
                onChange={(e) => patch({ endTime: e.target.value })}
              />
            </div>
            <Input
              label="Event time zone"
              required
              list="event-timezones"
              value={input.timezone}
              onChange={(e) => patch({ timezone: e.target.value })}
              helperText="Times are local to this zone. Example: America/Chicago. Start/end times describe the whole appearance, not a separate daily schedule."
            />
            <datalist id="event-timezones">
              {[
                "America/Chicago",
                "America/New_York",
                "America/Denver",
                "America/Los_Angeles",
                "America/Phoenix",
                "Europe/London",
                "UTC",
              ].map((zone) => (
                <option value={zone} key={zone} />
              ))}
            </datalist>
            <Input
              label="Venue"
              maxLength={180}
              value={input.venue}
              onChange={(e) => patch({ venue: e.target.value })}
            />
            <Input
              label="Public venue address"
              maxLength={300}
              value={input.address}
              onChange={(e) => patch({ address: e.target.value })}
            />
            <div className="field-grid">
              <Input
                label="City"
                maxLength={120}
                value={input.city}
                onChange={(e) => patch({ city: e.target.value })}
              />
              <Input
                label="State / region"
                maxLength={120}
                value={input.region}
                onChange={(e) => patch({ region: e.target.value })}
              />
              <Input
                label="Country"
                maxLength={100}
                value={input.country}
                onChange={(e) => patch({ country: e.target.value })}
              />
              <Input
                label="Booth / meet-and-greet location"
                maxLength={180}
                value={input.booth}
                onChange={(e) => patch({ booth: e.target.value })}
              />
            </div>
            <Input
              label="Public event / ticket website"
              maxLength={1000}
              value={input.eventUrl}
              onChange={(e) => patch({ eventUrl: e.target.value })}
              helperText="example.com and full http/https links are accepted. This link is shown to patrons."
            />
            <Textarea
              label="Public appearance description"
              rows={5}
              maxLength={4000}
              value={input.publicDescription}
              onChange={(e) => patch({ publicDescription: e.target.value })}
              helperText="Tell patrons what they can see or do: prints, merchandise, a signing or a meet-and-greet. Include any day-specific hours here."
            />
          </fieldset>
          <fieldset disabled={disabled} className="event-fields">
            <legend>Private application and planning</legend>
            <div className="field-grid">
              <Input
                label="Organizer / contact"
                maxLength={180}
                value={input.organizer}
                onChange={(e) => patch({ organizer: e.target.value })}
              />
              <Input
                label="Organizer email"
                type="email"
                maxLength={254}
                value={input.organizerEmail}
                onChange={(e) => patch({ organizerEmail: e.target.value })}
              />
            </div>
            <Input
              label="Private application link"
              maxLength={1000}
              value={input.applicationUrl}
              onChange={(e) => patch({ applicationUrl: e.target.value })}
            />
            <Textarea
              label="Private planning notes"
              maxLength={4000}
              rows={5}
              value={input.notes}
              onChange={(e) => patch({ notes: e.target.value })}
            />
          </fieldset>
          <section
            aria-label="Event deadlines"
            id="event-edit-tasks"
            tabIndex={-1}
          >
            <div className="event-section-heading">
              <h2>Deadlines, fees and preparation</h2>
              {canEdit && (
                <Button
                  disabled={disabled || input.tasks.length >= 40}
                  variant="secondary"
                  onClick={() => {
                    const taskId = crypto.randomUUID();
                    patch({
                      tasks: [
                        ...input.tasks,
                        {
                          id: taskId,
                          title: "",
                          kind: "application",
                          dueDate: "",
                          dueTime: "",
                          timezone: input.timezone,
                          status: "todo",
                          details: "",
                          feeMinor: null,
                          feeStatus: "unpaid",
                          feeReference: "",
                        },
                      ],
                    });
                    setFees({ ...fees, [taskId]: "" });
                  }}
                >
                  Add deadline
                </Button>
              )}
            </div>
            {!input.tasks.length && (
              <p className="empty-state">
                Add application deadlines, booth payments, packing tasks or
                other dated work.
              </p>
            )}
            {input.tasks.map((task, index) => (
              <fieldset
                key={task.id}
                id={`deadline-${task.id}`}
                tabIndex={-1}
                className="event-fields event-deadline"
                disabled={disabled}
              >
                <legend>
                  Deadline {index + 1}
                  {task.title ? ` · ${task.title}` : ""}
                </legend>
                <Input
                  label={`Deadline ${index + 1} title`}
                  required
                  maxLength={180}
                  value={task.title}
                  onChange={(e) =>
                    patchTask(task.id, { title: e.target.value })
                  }
                />
                <div className="field-grid">
                  <label className="field">
                    Deadline {index + 1} type
                    <select
                      value={task.kind}
                      onChange={(e) =>
                        patchTask(task.id, {
                          kind: e.target.value as EventTask["kind"],
                        })
                      }
                    >
                      {eventTaskKinds.map((kind) => (
                        <option value={kind} key={kind}>
                          {words(kind)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Deadline {index + 1} status
                    <select
                      value={task.status}
                      onChange={(e) =>
                        patchTask(task.id, {
                          status: e.target.value as EventTask["status"],
                        })
                      }
                    >
                      <option value="todo">To do</option>
                      <option value="done">Done</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </label>
                  <Input
                    label={`Deadline ${index + 1} due date`}
                    required
                    type="date"
                    value={task.dueDate}
                    onChange={(e) =>
                      patchTask(task.id, { dueDate: e.target.value })
                    }
                  />
                  <Input
                    label={`Deadline ${index + 1} cutoff time (optional)`}
                    type="time"
                    value={task.dueTime}
                    onChange={(e) =>
                      patchTask(task.id, { dueTime: e.target.value })
                    }
                  />
                </div>
                <Input
                  label={`Deadline ${index + 1} time zone`}
                  list="event-timezones"
                  required
                  value={task.timezone}
                  onChange={(e) =>
                    patchTask(task.id, { timezone: e.target.value })
                  }
                />
                <Textarea
                  label={`Deadline ${index + 1} details (private)`}
                  maxLength={2000}
                  value={task.details}
                  onChange={(e) =>
                    patchTask(task.id, { details: e.target.value })
                  }
                />
                <div className="field-grid">
                  <Input
                    label={`Deadline ${index + 1} fee (USD)`}
                    inputMode="decimal"
                    value={fees[task.id] ?? ""}
                    onChange={(e) =>
                      setFees({ ...fees, [task.id]: e.target.value })
                    }
                    helperText="Blank means unknown or not entered; 0 means free."
                  />
                  <label className="field">
                    Deadline {index + 1} fee status
                    <select
                      value={task.feeStatus}
                      onChange={(e) =>
                        patchTask(task.id, {
                          feeStatus: e.target.value as EventTask["feeStatus"],
                        })
                      }
                    >
                      <option value="unpaid">Not recorded paid</option>
                      <option value="paid">Paid externally</option>
                      <option value="waived">Waived</option>
                    </select>
                  </label>
                </div>
                <Input
                  label={`Deadline ${index + 1} fee receipt/reference (private)`}
                  maxLength={500}
                  value={task.feeReference}
                  onChange={(e) =>
                    patchTask(task.id, { feeReference: e.target.value })
                  }
                  helperText="Required when recording a paid fee. This does not send money or submit an application."
                />
                {record?.completionDates[task.id] && (
                  <p>
                    Last recorded completion: {record.completionDates[task.id]}
                  </p>
                )}
                {!record?.input.tasks.some((saved) => saved.id === task.id) && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      patch({
                        tasks: input.tasks.filter((row) => row.id !== task.id),
                      });
                      const next = { ...fees };
                      delete next[task.id];
                      setFees(next);
                    }}
                  >
                    Remove unsaved deadline
                  </Button>
                )}
              </fieldset>
            ))}
          </section>
          {canEdit && (
            <div className="event-fields">
              <Textarea
                label="Private action note"
                required
                minLength={3}
                maxLength={2000}
                disabled={disabled}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                helperText="Explain this save or publication change for the history. This note is not public."
              />
              <Button type="submit" disabled={disabled}>
                {record ? "Update event" : "Save event"}
              </Button>
            </div>
          )}
        </form>
      )}
      <details className="event-help event-publication">
        <summary>Public appearance preview & publishing</summary>
        <section aria-label="Publication">
          <h2>Public appearance preview</h2>
          <p>
            {dirty
              ? "Preview of unsaved form details. Save and review before publishing."
              : "Review exactly what patrons will see before publishing."}{" "}
            Private notes, applications, deadlines and fees are excluded.
          </p>
          {preview.success ? (
            <AppearanceCard appearance={preview.data} />
          ) : (
            <p>Complete valid public details to preview the appearance.</p>
          )}
          {canEdit && record && (
            <div className="inv-actions">
              {!editing && (
                <Textarea
                  label="Private action note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={disabled}
                  maxLength={2000}
                  helperText="Explain this publication change for the private history."
                />
              )}
              <Button
                disabled={
                  disabled ||
                  dirty ||
                  record.input.status !== "confirmed" ||
                  record.input.archived
                }
                onClick={() => action("publish")}
              >
                {record.published
                  ? "Publish appearance again"
                  : "Publish appearance"}
              </Button>
              {record.published && (
                <Button
                  variant="secondary"
                  disabled={disabled || dirty}
                  onClick={() => action("unpublish")}
                >
                  Unpublish appearance
                </Button>
              )}
            </div>
          )}
          {record && !record.published && (
            <p>
              Only saved, confirmed appearances with complete public details can
              be published. Enter a new Private action note before publishing.
            </p>
          )}
          {record?.published && (
            <p>
              Changes to public appearance details automatically remove this
              listing until you publish it again.
            </p>
          )}
        </section>
      </details>
      {detail && (
        <details className="event-help">
          <summary>Event history ({detail.history.length})</summary>
          {detail.history.map((entry) => (
            <article key={entry.revision} className="inv-panel">
              <p>
                Revision {entry.revision} · {entry.action} · {entry.createdAt}
              </p>
              <p className="preserve-lines">{entry.note}</p>
            </article>
          ))}
        </details>
      )}
      <details className="event-help">
        <summary>How to manage events and appearances</summary>
        <EventHelp />
      </details>
    </div>
  );
}
