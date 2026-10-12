import { describe, expect, it } from "vitest";
import {
  applyStudioEvent,
  assertAppearanceReady,
  eventAppearance,
  eventCalendarDays,
  eventLocalNow,
  eventTaskOverdue,
  studioEventCommandSchema,
  studioEventInputSchema,
  type StudioEventInput,
} from "./events";
const now = "2026-10-06T02:00:00.000Z";
const input: StudioEventInput = {
  title: "Autumn Art Market",
  kind: "market",
  status: "considering",
  archived: false,
  startDate: "2026-11-14",
  endDate: "2026-11-15",
  startTime: "10:00",
  endTime: "17:00",
  timezone: "America/Chicago",
  venue: "Arts Hall",
  address: "100 Example Avenue",
  city: "Roberts",
  region: "WI",
  country: "United States",
  booth: "B12",
  publicDescription: "Meet Sadboi and browse prints.",
  eventUrl: "https://example.com",
  organizer: "PRIVATE ORGANIZER",
  organizerEmail: "private@example.test",
  applicationUrl: "https://private.example.test/apply",
  notes: "PRIVATE NOTES",
  tasks: [
    {
      id: crypto.randomUUID(),
      title: "Apply for booth",
      kind: "application",
      dueDate: "2026-10-05",
      dueTime: "",
      timezone: "America/Chicago",
      status: "todo",
      details: "PRIVATE TASK",
      feeMinor: 2500,
      feeStatus: "unpaid",
      feeReference: "PRIVATE RECEIPT",
    },
  ],
};
const id = crypto.randomUUID();
const cmd = (action: string, expectedRevision: number, extra = {}) =>
  studioEventCommandSchema.parse({
    action,
    expectedRevision,
    id,
    operationId: crypto.randomUUID(),
    note: "Private history note",
    ...extra,
  });
describe("event planning and public appearances", () => {
  it("accepts undated prospects, normalizes website addresses and rejects invalid fields", () => {
    expect(
      studioEventInputSchema.parse({ ...input, eventUrl: "www.example.com" })
        .eventUrl,
    ).toBe("https://www.example.com");
    expect(
      studioEventInputSchema.safeParse({
        ...input,
        startDate: "",
        endDate: "",
        startTime: "",
        endTime: "",
      }).success,
    ).toBe(true);
    for (const patch of [
      { endDate: "2026-11-13" },
      { timezone: "not/a-zone" },
      { eventUrl: "javascript:alert(1)" },
      { eventUrl: "https://user:pass@example.com" },
      { startDate: "2026-02-30" },
      { startTime: "25:00" },
      { tasks: [input.tasks[0], input.tasks[0]] },
      { published: true },
    ])
      expect(
        studioEventInputSchema.safeParse({ ...input, ...patch }).success,
      ).toBe(false);
    expect(
      studioEventInputSchema.safeParse({
        ...input,
        endDate: input.startDate,
        startTime: "17:00",
        endTime: "10:00",
      }).success,
    ).toBe(false);
  });
  it("validates fee receipts and integer cents independently of task completion", () => {
    for (const patch of [
      { feeMinor: -1 },
      { feeMinor: 1.5 },
      { feeMinor: 100_000_001 },
      { feeStatus: "paid", feeMinor: null },
      { feeStatus: "paid", feeReference: "" },
    ])
      expect(
        studioEventInputSchema.safeParse({
          ...input,
          tasks: [{ ...input.tasks[0], ...patch }],
        }).success,
      ).toBe(false);
    const done = studioEventInputSchema.parse({
      ...input,
      tasks: [{ ...input.tasks[0], status: "done" }],
    });
    expect(done.tasks[0].feeStatus).toBe("unpaid");
  });
  it("keeps confirmation private until a separate publication with required details", () => {
    const record = applyStudioEvent(
      null,
      cmd("save", 0, { input: { ...input, status: "confirmed" } }),
      now,
    );
    expect(record.published).toBeNull();
    expect(
      applyStudioEvent(record, cmd("publish", 1), now).published?.title,
    ).toBe(input.title);
    for (const patch of [
      { status: "considering" },
      { archived: true },
      { startDate: "" },
      { endDate: "" },
      { venue: "" },
      { publicDescription: "" },
      { endDate: "2020-01-01" },
    ])
      expect(() =>
        assertAppearanceReady(
          { ...input, status: "confirmed", ...patch } as StudioEventInput,
          now,
        ),
      ).toThrow();
  });
  it("publishes an explicit allowlist and removes stale or cancelled appearances", () => {
    const created = applyStudioEvent(
      null,
      cmd("save", 0, { input: { ...input, status: "confirmed" } }),
      now,
    );
    const published = applyStudioEvent(created, cmd("publish", 1), now);
    expect(JSON.stringify(eventAppearance(input))).not.toMatch(
      /PRIVATE|organizer|tasks|notes|fee|applicationUrl/,
    );
    for (const patch of [
      { venue: "New Hall" },
      { title: "Changed public name" },
      { status: "cancelled" },
      { status: "declined" },
      { archived: true },
    ])
      expect(
        applyStudioEvent(
          published,
          cmd("save", 2, { input: { ...published.input, ...patch } }),
          now,
        ).published,
      ).toBeNull();
    expect(
      applyStudioEvent(
        published,
        cmd("save", 2, {
          input: { ...published.input, notes: "Private update" },
        }),
        now,
      ).published,
    ).toEqual(published.published);
    expect(
      applyStudioEvent(published, cmd("unpublish", 2), now).published,
    ).toBeNull();
  });
  it("records and reopens task completion while retaining saved tasks and rejecting stale writes", () => {
    const created = applyStudioEvent(null, cmd("save", 0, { input }), now);
    const doneInput = {
      ...input,
      tasks: [{ ...input.tasks[0], status: "done" }],
    };
    const done = applyStudioEvent(
      created,
      cmd("save", 1, { input: doneInput }),
      now,
    );
    expect(done.completionDates[input.tasks[0].id]).toBe(now);
    expect(created.completionDates).toEqual({});
    expect(
      applyStudioEvent(done, cmd("save", 2, { input }), now).completionDates,
    ).toEqual({});
    expect(() =>
      applyStudioEvent(done, cmd("save", 1, { input }), now),
    ).toThrow(/changed/);
    expect(() =>
      applyStudioEvent(
        done,
        cmd("save", 2, { input: { ...input, tasks: [] } }),
        now,
      ),
    ).toThrow(/Cancel/);
    expect(() =>
      applyStudioEvent(
        { ...done, revision: 200 },
        { ...cmd("save", 2, { input }), expectedRevision: 200 },
        now,
      ),
    ).toThrow(/limit/);
  });
  it("compares deadlines in their own zone and leaves date-only tasks open until that date ends", () => {
    const task = input.tasks[0];
    expect(eventLocalNow(now, "America/Chicago")).toEqual({
      date: "2026-10-05",
      time: "21:00",
    });
    expect(eventTaskOverdue(task, now)).toBe(false);
    expect(eventTaskOverdue({ ...task, dueTime: "20:59" }, now)).toBe(true);
    expect(eventTaskOverdue({ ...task, dueTime: "21:00" }, now)).toBe(false);
    expect(eventTaskOverdue({ ...task, timezone: "UTC" }, now)).toBe(true);
    expect(
      eventTaskOverdue({ ...task, dueDate: "2020-01-01", status: "done" }, now),
    ).toBe(false);
    expect(eventLocalNow("2026-03-08T08:30:00Z", "America/Chicago").time).toBe(
      "03:30",
    );
  });
  it("cannot leave a published appearance locked behind the history limit", () => {
    const created = applyStudioEvent(
      null,
      cmd("save", 0, { input: { ...input, status: "confirmed" } }),
      now,
    );
    const published = {
      ...applyStudioEvent(created, cmd("publish", 1), now),
      revision: 199,
    };
    expect(() => applyStudioEvent(published, cmd("publish", 199), now)).toThrow(
      /room/,
    );
    expect(
      applyStudioEvent(
        published,
        cmd("save", 199, { input: published.input }),
        now,
      ).published,
    ).toBeNull();
    expect(
      applyStudioEvent(published, cmd("unpublish", 199), now).published,
    ).toBeNull();
  });
  it("creates a stable six-week calendar spanning leap day and year boundaries", () => {
    const leap = eventCalendarDays("2028-02");
    expect(leap).toHaveLength(42);
    expect(leap).toContain("2028-02-29");
    expect(new Set(leap).size).toBe(42);
    const january = eventCalendarDays("2027-01");
    expect(january[0]).toBe("2026-12-27");
    expect(january.at(-1)).toBe("2027-02-06");
  });
});
