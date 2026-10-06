import { notFound } from "next/navigation";
import { AccessError, requireStaff } from "@/server/staff";
import { agreementDetail } from "@/server/agreements";
import { Agreement } from "@/components/agreement";
import { inventoryId } from "@sadboi/core";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ proposalId?: string }>;
}) {
  const staff = await requireStaff(["super_admin", "legal", "accounting"]),
    params = await searchParams,
    proposalId = inventoryId.safeParse(params.proposalId);
  if (!proposalId.success) notFound();
  let initial: Awaited<ReturnType<typeof agreementDetail>>;
  try {
    initial = await agreementDetail({ proposalId: proposalId.data }, staff);
  } catch (error) {
    if (error instanceof AccessError && error.status === 404) notFound();
    throw error;
  }
  return (
    <Agreement
      initial={initial}
      canEdit={staff.role === "super_admin" || staff.role === "legal"}
      canViewProposal={staff.role !== "legal"}
    />
  );
}
