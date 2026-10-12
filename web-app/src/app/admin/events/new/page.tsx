import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { studioEventIdSchema } from "@sadboi/core";
import { AccessError, requireStaff } from "@/server/staff";
import { eventDetail } from "@/server/events";
import { EventEditor } from "@/components/event-editor";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const staff = await requireStaff(["super_admin"]),
    parsed = studioEventIdSchema.safeParse((await searchParams).id);
  if (!parsed.success) redirect(`/admin/events/new?id=${randomUUID()}`);
  let initial = null;
  try {
    initial = await eventDetail(parsed.data, staff);
  } catch (error) {
    if (!(error instanceof AccessError && error.status === 404)) throw error;
  }
  return <EventEditor id={parsed.data} initial={initial} canEdit />;
}
