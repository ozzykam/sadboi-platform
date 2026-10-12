# Event planning and public appearances

## Staff workflow

**Events** (`/admin/events`) is the shared planner for conventions, markets, festivals, exhibitions, meet-and-greets and other opportunities. Super admins manage records and publication; accounting reads the planner, fees and history. Legal users do not have event-planning access.

The default **To-do** view lists open application, booth-payment, preparation and other deadlines, with overdue items first, their local due date/time/zone, fee amount and fee status. **Calendar** shows a six-week month with event date ranges and deadlines; its cells link to the event overview or the matching to-do. Search, attendance-status filtering and archived-event visibility apply to the event list. Closed tasks can be included separately. Cancelled, declined and archived events do not contribute active deadlines. Undated opportunities stay in the event table.

Saved events open in a readable overview with dates/location, attendance/publication badges, next to-do, task details/fees/completion and private application/planning information. **Edit event** opens the form; **Edit to-dos** or a task's **Edit** button focuses the relevant section. **Update event** saves and returns to the overview. **Cancel editing** returns without saving; unsaved changes require choosing **Discard changes** or **Keep editing**. New events start in the form and show the overview after their first save. Accounting gets the same overview without edit controls. Publication, saved-record recovery and history are available in expandable sections.

1. **Add event** and enter its name/type. Use Considering, Preparing, Applied, Waitlisted, Confirmed, Declined or Cancelled to record the studio's application/attendance status. Research-stage events may have unknown dates or venue details.
2. Add deadlines with a title, type, due date, optional cutoff time, time zone and private instructions. A deadline can be for an application, payment, packing or any other dated work. Each deadline has an optional USD fee and paid/waived state. Blank fee means unknown/not entered; zero means free. Paid fees require a positive amount and receipt/reference.
3. Add a private action note and **Save event**. Set a deadline to Done when completed; its completion timestamp is recorded. Reopening clears the current completion date while preserving history. Existing deadlines can be cancelled but not removed; newly added unsaved ones can be removed.
4. Once attendance is confirmed, set Confirmed and complete the dates, venue, city, country and public description. Use the same start/end date for a one-day event. Event times describe the start and end of the whole appearance; put day-specific hours in the public description.
5. Save all edits, expand **Public appearance preview & publishing**, review the appearance, enter a new private action note and choose **Publish appearance**. The user explicitly required publication as a separate action from confirmation.

Date-only deadlines stay open through the end of their listed local date. Timed deadlines become overdue after the listed local cutoff minute. Time zones use IANA names such as America/Chicago and are validated; this is a planning calendar, not a timed reminder/scheduler. Daylight-saving rules are supplied by the runtime's time-zone data. Calendar cells use the date as recorded locally rather than converting everything to the viewer's zone.

Application status, task completion and fee payment are distinct. Completing an application does not pay its fee or confirm attendance. No external application, payment, email or accounting entry is created.

## Public schedule and privacy

**Appearances** (`/appearances`) is linked from the public header and homepage. Patrons can use a schedule or monthly calendar, then inspect event dates/times/time zone, venue/address/city/region/country, booth or meet-and-greet details, public description and the event/ticket website. Only explicitly published, confirmed, non-archived current/upcoming appearances are returned. An appearance is current through its local end date; past appearances are omitted automatically.

The public projection is an explicit allowlist. Organizer name/email, application URL, tasks, fees, receipt references, planning notes, history, staff actors and operation receipts never reach the public page or `/api/appearances` response. Only http/https public links without embedded credentials are accepted; bare domain addresses are normalized to https. React renders descriptions as text.

Editing a public field automatically unpublishes that event, as do cancellation, decline, other non-confirmed states and archiving. Staff must review and publish it again. Private-only edits preserve an unchanged published appearance. **Unpublish appearance** withdraws it immediately. The public page is dynamic and the JSON response is no-store; previously opened browser pages show their last loaded content until refreshed.

## Persistence and recovery

`businesses/sadboi/studioEvents/{uuid}` holds the staff input, public snapshot, publication flag/timestamp, completion timestamps and revision. Each mutation creates an immutable `history/{revision}` snapshot with action, note, actor and server time. `eventOperations` stores actor-scoped idempotency fingerprints/results. `eventState/counts` bounds event creation transactionally.

Mutations require strict validated commands, authenticated super-admin access, same origin/CSRF and expected revision. Concurrent edits cannot both commit from the same revision. Identical retries return the original result; different content cannot reuse an operation ID. Public reads recheck confirmation, archive state, dates and equality of the current public fields with the saved publication snapshot. Existing client Firestore deny rules remain unchanged.

The new-event page obtains a stable UUID in its URL before editing so reload/recovery can find the same operation and record. **Retry same event action** resubmits a pending request; **Recover interrupted action** retrieves it in the same browser tab when session storage is available. **Reload event** discards unsaved changes. With unavailable browser storage, review saved records/history before repeating uncertain work.

Limits: 500 event records including archives, 40 deadlines per event, 200 changes per event, USD fees up to $1,000,000 and bounded text fields. Publishing requires room for a later withdrawal; the final permitted save withdraws any listing so the history cap cannot leave it permanently published. No deletion workflow is included. Public lookup uses a single-field publication filter; no new composite indexes, environment variables or provider settings are needed.

## Validation

Overview/edit UX follow-up: `pnpm check` passed again with all 126 domain tests and the production build. Chrome verified the readable overview at desktop/390px, task-specific edit focus, cancel/discard restoring saved details, and an emulator task update returning to the overview with its saved instructions, completion time and fee. The event-name form was absent after saving and Edit event was visible. No captured console errors or mobile page overflow. Existing business records were only inspected; save verification used disposable emulator data.

Final `pnpm check` passed: TypeScript, ESLint, **126 domain tests**, seven Firebase credential tests, two runtime tests and the production build, including all event/appearance routes. `git diff --check` passed.

The focused Auth/Firestore emulator run passed **31 grouped integration checks** covering authentication, role restrictions, CSRF, strict validation, separate confirmation/publication, safe public JSON and rendered HTML, revision races, idempotent recovery, task completion, fees, withdrawal, expiry and bounded history. Disposable emulators shut down successfully.

Chrome verified the public schedule/calendar, month navigation and multi-day links; staff completion and saved fee changes; separate unpublish/republish; completed-task filtering; and creating an undated research opportunity. Public schedule and staff editor fit a 390px viewport without page overflow. No browser console errors were captured. Temporary viewport overrides and the test tab were cleared. Only local emulator fixtures were changed.

## Deferred scope

Proof/review development and Stripe commission payment collection are paused at the user's request. This event slice does not include application submission, payment execution, automated reminders/email, Google/Outlook synchronization, recurring-event generation, uploads, event inventory transfers/POS, gallery settlements or profitability reporting. Those remain separate build work. No deployment or real event publication is performed during local implementation.
