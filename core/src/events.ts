import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);
export const studioEventIdSchema = z.uuid();
const date = z.union([z.literal(""), z.iso.date()]);
const time = z.union([
  z.literal(""),
  z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a 24-hour time."),
]);
export const eventTimezoneSchema = text(100)
  .min(1)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
      return true;
    } catch {
      return false;
    }
  }, "Choose a valid time zone, such as America/Chicago.");
const website = text(1000)
  .transform((value) =>
    value && !/^[a-z][a-z\d+.-]*:/i.test(value) ? `https://${value}` : value,
  )
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return (
        ["http:", "https:"].includes(url.protocol) &&
        !!url.hostname &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }, "Use a website address beginning with http:// or https://.");
export const eventKinds = [
  "convention",
  "market",
  "festival",
  "exhibition",
  "meet_and_greet",
  "other",
] as const;
export const eventStatuses = [
  "considering",
  "preparing",
  "applied",
  "waitlisted",
  "confirmed",
  "declined",
  "cancelled",
] as const;
export const eventTaskKinds = [
  "application",
  "booth_payment",
  "preparation",
  "other",
] as const;
export const eventTaskSchema = z
  .object({
    id: z.uuid(),
    title: text(180).min(1),
    kind: z.enum(eventTaskKinds),
    dueDate: z.iso.date(),
    dueTime: time,
    timezone: eventTimezoneSchema,
    status: z.enum(["todo", "done", "cancelled"]),
    details: text(2000),
    feeMinor: z.number().int().min(0).max(100_000_000).nullable(),
    feeStatus: z.enum(["unpaid", "paid", "waived"]),
    feeReference: text(500),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (
      input.feeStatus === "paid" &&
      (input.feeMinor === null ||
        input.feeMinor <= 0 ||
        input.feeReference.length < 3)
    )
      ctx.addIssue({
        code: "custom",
        message: "A paid fee needs a positive amount and a receipt/reference.",
      });
  });
export type EventTask = z.infer<typeof eventTaskSchema>;
const publicFields = {
  title: text(180).min(3),
  kind: z.enum(eventKinds),
  startDate: date,
  endDate: date,
  startTime: time,
  endTime: time,
  timezone: eventTimezoneSchema,
  venue: text(180),
  address: text(300),
  city: text(120),
  region: text(120),
  country: text(100),
  booth: text(180),
  publicDescription: text(4000),
  eventUrl: website,
};
export const appearanceSchema = z.object(publicFields).strict();
export type Appearance = z.infer<typeof appearanceSchema>;
export const studioEventInputSchema = z
  .object({
    ...publicFields,
    status: z.enum(eventStatuses),
    archived: z.boolean(),
    organizer: text(180),
    organizerEmail: z.union([z.literal(""), z.email().max(254)]),
    applicationUrl: website,
    notes: text(4000),
    tasks: z.array(eventTaskSchema).max(40),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.endDate && (!input.startDate || input.endDate < input.startDate))
      ctx.addIssue({
        code: "custom",
        message: "The end date must be on or after the start date.",
      });
    if (
      (input.startTime && !input.startDate) ||
      (input.endTime && !input.endDate)
    )
      ctx.addIssue({
        code: "custom",
        message: "Add the corresponding date before entering a time.",
      });
    if (
      input.startDate === input.endDate &&
      input.startTime &&
      input.endTime &&
      input.endTime <= input.startTime
    )
      ctx.addIssue({
        code: "custom",
        message:
          "For a one-day event, the end time must be after the start time.",
      });
    if (new Set(input.tasks.map((task) => task.id)).size !== input.tasks.length)
      ctx.addIssue({
        code: "custom",
        message: "Each deadline needs a unique ID.",
      });
  });
export type StudioEventInput = z.infer<typeof studioEventInputSchema>;
const commandFields = {
  id: z.uuid(),
  expectedRevision: z.number().int().min(0).max(199),
  operationId: z.uuid(),
  note: text(2000).min(3),
};
export const studioEventCommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      ...commandFields,
      action: z.literal("save"),
      input: studioEventInputSchema,
    })
    .strict(),
  z.object({ ...commandFields, action: z.literal("publish") }).strict(),
  z.object({ ...commandFields, action: z.literal("unpublish") }).strict(),
]);
export type StudioEventCommand = z.infer<typeof studioEventCommandSchema>;
export type StudioEventRecord = {
  id: string;
  revision: number;
  input: StudioEventInput;
  published: Appearance | null;
  publishedAt: string | null;
  completionDates: Record<string, string>;
  createdAt: string;
  updatedAt: string;
};
// Explicit client-safe projection. Never spread staff input into a public response.
export function eventAppearance(input: StudioEventInput): Appearance {
  return {
    title: input.title,
    kind: input.kind,
    startDate: input.startDate,
    endDate: input.endDate,
    startTime: input.startTime,
    endTime: input.endTime,
    timezone: input.timezone,
    venue: input.venue,
    address: input.address,
    city: input.city,
    region: input.region,
    country: input.country,
    booth: input.booth,
    publicDescription: input.publicDescription,
    eventUrl: input.eventUrl,
  };
}
export function eventLocalNow(now: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(now));
  const part = (name: string) =>
    parts.find((item) => item.type === name)!.value;
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`,
  };
}
export function eventTaskOverdue(task: EventTask, now: string) {
  if (task.status !== "todo") return false;
  const local = eventLocalNow(now, task.timezone);
  return (
    task.dueDate < local.date ||
    (task.dueDate === local.date && !!task.dueTime && task.dueTime < local.time)
  );
}
export function assertAppearanceReady(input: StudioEventInput, now: string) {
  if (input.status !== "confirmed" || input.archived)
    throw new Error("Only confirmed, active events can be published.");
  if (
    !input.startDate ||
    !input.endDate ||
    !input.venue ||
    !input.city ||
    !input.country ||
    !input.publicDescription
  )
    throw new Error(
      "Add start/end dates, venue, city, country and a public description before publishing.",
    );
  if (input.endDate < eventLocalNow(now, input.timezone).date)
    throw new Error("Past appearances cannot be published.");
}
export function applyStudioEvent(
  old: StudioEventRecord | null,
  command: StudioEventCommand,
  now: string,
): StudioEventRecord {
  if ((old?.revision ?? 0) !== command.expectedRevision)
    throw new Error("This event changed. Reload it before editing again.");
  if (old && old.revision >= 200)
    throw new Error("The 200-change event history limit has been reached.");
  if (command.action !== "save" && !old)
    throw new Error("Save the event before publishing.");
  const input = command.action === "save" ? command.input : old!.input;
  if (
    old &&
    old.input.tasks.some(
      (task) => !input.tasks.some((next) => task.id === next.id),
    )
  )
    throw new Error(
      "Saved deadlines stay in the record. Cancel them instead of removing them.",
    );
  const completionDates = Object.fromEntries(
    input.tasks
      .filter((task) => task.status === "done")
      .map((task) => [
        task.id,
        old?.input.tasks.find((previous) => previous.id === task.id)?.status ===
        "done"
          ? (old.completionDates[task.id] ?? now)
          : now,
      ]),
  );
  let published = old?.published ?? null,
    publishedAt = old?.publishedAt ?? null;
  if (command.action === "publish") {
    if ((old?.revision ?? 0) >= 199)
      throw new Error(
        "Leave room in the event history to withdraw a published appearance.",
      );
    assertAppearanceReady(input, now);
    published = eventAppearance(input);
    publishedAt = now;
  } else if (
    command.action === "unpublish" ||
    (old?.revision ?? 0) + 1 >= 200 ||
    input.status !== "confirmed" ||
    input.archived ||
    (published &&
      JSON.stringify(eventAppearance(input)) !== JSON.stringify(published))
  ) {
    published = null;
    publishedAt = null;
  }
  return {
    id: command.id,
    revision: (old?.revision ?? 0) + 1,
    input,
    published,
    publishedAt,
    completionDates,
    createdAt: old?.createdAt ?? now,
    updatedAt: now,
  };
}
export type PublicAppearance = Appearance & { id: string };
export type EventCalendarEntry = {
  id: string;
  title: string;
  date: string;
  endDate: string;
  href: string;
  kind: "appearance" | "deadline";
  status?: string;
};
export function eventCalendarDays(month: string) {
  const start = new Date(`${month}-01T12:00:00Z`),
    offset = start.getUTCDay();
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(index - offset + 1);
    return date.toISOString().slice(0, 10);
  });
}
