/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";
import { Button, Input, Badge } from "./ui";
import { inventoryRequest } from "@/lib/inventory-client";
export function StoreOrdersAdmin({
  initial,
}: {
  initial: { orders: Array<Record<string, any>> };
}) {
  const [orders, setOrders] = useState(initial.orders),
    [selected, setSelected] = useState<any>(null),
    [message, setMessage] = useState("");
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await inventoryRequest("/api/store/fulfillment", {
      method: "POST",
      body: JSON.stringify({
        input: {
          orderId: selected.id,
          recipientName: String(data.get("recipientName")),
          address1: String(data.get("address1")),
          address2: String(data.get("address2")),
          city: String(data.get("city")),
          region: String(data.get("region")),
          postalCode: String(data.get("postalCode")),
          country: "US",
          method: String(data.get("method")),
          trackingNumber: String(data.get("trackingNumber")),
          status: String(data.get("status")),
          notes: String(data.get("notes")),
        },
      }),
    });
    setMessage("Fulfillment saved.");
    setSelected(null);
  }
  if (selected)
    return (
      <section className="inv-panel">
        <div className="section-heading">
          <h2>Fulfill {selected.orderNumber}</h2>
          <Button variant="ghost" onClick={() => setSelected(null)}>
            Close
          </Button>
        </div>
        <form className="inv-form" onSubmit={save}>
          <Input label="Recipient" name="recipientName" required />
          <Input label="Address" name="address1" required />
          <Input label="Address line 2" name="address2" />
          <Input label="City" name="city" required />
          <Input label="State" name="region" required />
          <Input label="Postal code" name="postalCode" required />
          <label className="field">
            Method
            <select name="method">
              <option value="standard">Standard</option>
              <option value="express">Express</option>
              <option value="pickup">Pickup</option>
            </select>
          </label>
          <Input label="Tracking number" name="trackingNumber" />
          <label className="field">
            Status
            <select name="status">
              <option value="packed">Packed</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <Input label="Notes" name="notes" />
          <Button type="submit">Save fulfillment</Button>
        </form>
      </section>
    );
  return (
    <section>
      <div className="section-heading">
        <h1>Customer orders</h1>
        <Button
          variant="secondary"
          onClick={async () =>
            setOrders((await inventoryRequest("/api/store/orders")).orders)
          }
        >
          Refresh orders
        </Button>
      </div>
      {message && <p className="notice">{message}</p>}
      {!orders.length && <p className="empty-state">No customer orders yet.</p>}
      <div className="inv-cards">
        {orders.map((order) => (
          <article className="inv-panel" key={order.id}>
            <Badge>{String(order.status).replaceAll("_", " ")}</Badge>
            <h2>{order.orderNumber}</h2>
            <p>
              {order.input.customerName} Â· {order.input.customerEmail}
            </p>
            <p>
              {order.lines
                .map((line: any) => line.quantity + " Ã— " + line.sku)
                .join(", ")}{" "}
              Â· ${(order.totalMinor / 100).toFixed(2)}
            </p>
            {order.status === "paid" && (
              <Button onClick={() => setSelected(order)}>
                Open fulfillment
              </Button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
