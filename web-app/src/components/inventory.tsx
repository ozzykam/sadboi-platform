"use client";

import Link from "next/link";
import { ArrowUpRight, Boxes } from "lucide-react";
import { availableStock, onlineAvailable } from "@sadboi/core";
import { useDrafts } from "@/lib/draft-store";
import { Badge, PageHeading } from "./ui";

export function Inventory() {
  const { catalog } = useDrafts();
  return (
    <>
      <PageHeading
        eyebrow="ART & PRODUCTS / INVENTORY"
        title="Know where the work is."
        description="Print variants, physical locations, and the stock actually available to sell."
      />
      <div className="notice">
        Inventory is a read-only model preview. Receiving, transfers, and
        reservations will use secure shared storage in the next inventory build.
      </div>
      {!catalog.variants.length ? (
        <div className="empty-state roomy">
          <Boxes size={34} strokeWidth={1.2} />
          <h2>One artwork. Many possibilities.</h2>
          <p>
            Explore how print sizes link to an original artwork and stock at
            different locations.
          </p>
          <Link href="/admin/settings" className="button secondary">
            Load sample catalog <ArrowUpRight size={16} />
          </Link>
        </div>
      ) : (
        <div className="inventory-list">
          {catalog.variants.map((variant) => (
            <section className="inventory-card" key={variant.id}>
              <div className="inventory-heading">
                <div>
                  <p className="eyebrow">{variant.sku}</p>
                  <h2>{variant.name}</h2>
                  <p>{variant.options}</p>
                </div>
                <div className="online-count">
                  <strong>{onlineAvailable(catalog, variant.id)}</strong>
                  <span>available online</span>
                </div>
              </div>
              <div
                className="table-scroll"
                tabIndex={0}
                role="region"
                aria-label={`Stock for ${variant.name}`}
              >
                <table>
                  <caption className="sr-only">
                    Physical stock and commitments by location
                  </caption>
                  <thead>
                    <tr>
                      <th>Location</th>
                      <th>On hand</th>
                      <th>Reserved</th>
                      <th>Allocated</th>
                      <th>Unavailable</th>
                      <th>Available</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalog.stock
                      .filter((s) => s.variantId === variant.id)
                      .map((stock) => {
                        const location = catalog.locations.find(
                          (l) => l.id === stock.locationId,
                        );
                        return (
                          <tr key={stock.locationId}>
                            <td>
                              {location?.name}
                              <small>
                                {location?.onlineEligible
                                  ? "Online fulfillment"
                                  : "Excluded from online stock"}
                              </small>
                            </td>
                            <td>{stock.onHand}</td>
                            <td>{stock.reserved}</td>
                            <td>{stock.allocated}</td>
                            <td>{stock.unavailable}</td>
                            <td>
                              <Badge tone="green">
                                {availableStock(stock)}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
              <Link
                href={`/admin/artworks/${variant.artworkId}`}
                className="inventory-art-link"
              >
                View original artwork <ArrowUpRight size={15} />
              </Link>
            </section>
          ))}
        </div>
      )}
      <div className="inventory-explainer">
        <span>HOW AVAILABILITY WORKS</span>
        <p>
          On hand <b>−</b> Reserved <b>−</b> Allocated <b>−</b> Unavailable{" "}
          <b>=</b> Available
        </p>
        <small>
          Gallery and transit stock stays separate from website availability.
        </small>
      </div>
    </>
  );
}
