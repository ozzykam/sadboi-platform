import { AccessError, requireStaff } from "@/server/staff";
import { proposalDetail } from "@/server/proposals";
import { Proposal } from "@/components/proposal";
import { proposalSourceSchema } from "@sadboi/core";
import { notFound } from "next/navigation";
export default async function Page({ searchParams }: { searchParams: Promise<{ kind?: string; id?: string }> }) {
  const staff = await requireStaff(["super_admin", "accounting"]), params = await searchParams;
  const source = proposalSourceSchema.safeParse({ kind: params.kind, id: params.id }); if (!source.success) notFound();
  let initial: Awaited<ReturnType<typeof proposalDetail>>;
  try { initial = await proposalDetail(source.data, staff); }
  catch (error) { if (error instanceof AccessError && error.status === 404) notFound(); throw error; }
  return <Proposal initial={initial} canEdit={staff.role === "super_admin"} />;
}
