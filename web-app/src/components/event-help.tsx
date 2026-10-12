export function EventHelp() {
  return (
    <section
      className="howto-section"
      id="events"
      aria-labelledby="events-title"
    >
      <h2 id="events-title">Plan events and publish appearances</h2>
      <p>
        Opening a saved event shows its overview: dates, venue, attendance and
        publication status, to-do items, fees and private planning notes. Choose
        Edit event to change the details, Edit to-dos to jump to the task list,
        or Edit beside an individual to-do. Update event saves your changes and
        returns to the overview. Cancel editing lets you discard unsaved
        changes.
      </p>
      <ol>
        <li>
          Open Events and choose Add event. Record a convention, market,
          festival, exhibition or other appearance, even if the dates are still
          unknown. Start with Considering; use Preparing, Applied or Waitlisted
          to track the application.
        </li>
        <li>
          Add deadlines for applications, booth payments, preparation or other
          work. Each deadline has its own date, optional cutoff time and time
          zone. An empty cutoff time means the whole local date. Add
          instructions and an optional fee in USD; blank means unknown, while 0
          means free.
        </li>
        <li>
          Use Done after completing a task. Fee status is separate: recording
          Paid requires an amount and a receipt/reference. Completing an
          application does not mark a fee paid, submit an application or confirm
          attendance. Saved deadlines can be cancelled, and completed deadlines
          can be reopened; history retains earlier details.
        </li>
        <li>
          When attendance is confirmed, set the event to Confirmed and complete
          its public dates, venue, city, country and description. Save, review
          the Public appearance preview, add another action note and choose
          Publish appearance under Public appearance preview &amp; publishing.
          Confirmation alone does not publish it.
        </li>
        <li>
          Patrons find published current and upcoming events under Appearances.
          They can view a schedule or calendar with location, booth details and
          the public event link. Staff application links, organizer contact
          details, fees, tasks and private notes are never included.
        </li>
      </ol>
      <p>
        <strong>Example:</strong> add “Autumn Art Market” as Considering, with
        “Submit vendor application” due September 15 at 5:00 PM America/Chicago
        and a $25 fee. Add a separate “Pay booth balance” deadline with a $150
        fee and a preparation task for packing prints. Mark the application Done
        after submitting it; record its fee Paid with a receipt reference. After
        acceptance, confirm the market dates and booth location, then publish
        the appearance.
      </p>
      <p>
        <strong>Agenda and calendar:</strong> To-do lists open deadlines first,
        including overdue ones. Show completed/cancelled deadlines to inspect
        closed tasks. The calendar includes dated events and the selected
        deadlines; undated prospects remain in the event table. Each time is
        local to the displayed time zone. Declined, cancelled and archived
        events are excluded from active deadlines.
      </p>
      <p>
        <strong>Publication changes:</strong> editing a public field,
        cancelling, declining or archiving automatically unpublishes the
        appearance. Save and publish again after checking the preview. Private
        note or deadline changes do not remove an otherwise unchanged published
        appearance. Past appearances disappear from the public schedule after
        their end date in the event’s time zone.
      </p>
      <p>
        <strong>Recovery and limits:</strong> enter a private action note for
        each save, publish or unpublish. Reload discards unsaved edits. Retry
        same event action or Recover interrupted action in the same browser tab
        after an uncertain save. There are limits of 500 events, 40 deadlines
        per event and 200 changes per event. Super admins manage; accounting
        reads. Fees are planning/receipt records only: this feature does not pay
        organizers, submit applications, send reminders, sync external calendars
        or post accounting entries.
      </p>
    </section>
  );
}
