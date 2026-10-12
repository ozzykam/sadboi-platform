import { notFound } from "next/navigation";
import { AccessError, requireStaff } from "@/server/staff";
import { eventDetail } from "@/server/events";
import { EventEditor } from "@/components/event-editor";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const staff = await requireStaff(["super_admin", "accounting"]),
    { id } = await params;
  let initial;
  try {
    initial = await eventDetail(id, staff);
  } catch (error) {
    if (error instanceof AccessError && [400, 404].includes(error.status))
      notFound();
    throw error;
  }
  return (
    <EventEditor
      id={id}
      initial={initial}
      canEdit={staff.role === "super_admin"}
    />
  );
}
