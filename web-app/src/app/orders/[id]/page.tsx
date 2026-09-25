import { CustomerOrder } from "@/components/customer-order";
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  return <main className="customer-order"><CustomerOrder orderId={(await params).id} /></main>;
}
