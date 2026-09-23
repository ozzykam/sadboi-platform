import { expect, it } from "vitest";
import { assertStock, moveStock, parseUsd, stockLocationInputSchema, movementInputSchema, stockVariantInputSchema } from "./inventory";
const balance = {variantId:"a".repeat(64),locationId:"b".repeat(64),onHand:20,reserved:4,allocated:3,unavailable:2,revision:1};
it("preserves commitments when stock leaves a location",()=> {
  expect(moveStock(balance,"adjust",-11).onHand).toBe(9);
  expect(()=>moveStock(balance,"adjust",-12)).toThrow();
});
it("moves damaged stock out of availability before discarding it",()=> {
  const damaged=moveStock(balance,"quarantine",5);
  expect(damaged.onHand).toBe(20);expect(damaged.unavailable).toBe(7);
  const discarded=moveStock(damaged,"discard",7);expect(discarded.onHand).toBe(13);expect(discarded.unavailable).toBe(0);
  expect(()=>moveStock(discarded,"discard",1)).toThrow();
});
it("restores only stock that is unavailable",()=>{
  expect(moveStock(balance,"release",2).unavailable).toBe(0);
  expect(()=>moveStock(balance,"release",3)).toThrow();
});
it("receives rejected units without making them available",()=>{
  const received=moveStock(balance,"receive_quarantined",6);
  expect(received.onHand).toBe(26);
  expect(received.unavailable).toBe(8);
  expect(received.onHand-received.reserved-received.allocated-received.unavailable).toBe(11);
  expect(received.revision).toBe(2);
});
it("rejects fractional units, overflow and broken balances",()=>{
  expect(()=>moveStock(balance,"receive",1.5)).toThrow();
  expect(()=>moveStock({...balance,onHand:1_000_000_000},"receive",1)).toThrow();
  expect(()=>assertStock({...balance,reserved:21})).toThrow();
});
it("parses USD without floating point multiplication errors",()=>{
  expect(parseUsd("19.99")).toBe(1999);expect(parseUsd("0.29")).toBe(29);expect(parseUsd("12.")).toBe(1200);
  for(const value of ["-1","1e2","1.234","", "NaN"])expect(()=>parseUsd(value)).toThrow();
});
it("requires a reason and revision for adjustments and excludes transit from online availability",()=>{
  expect(movementInputSchema.safeParse({variantId:balance.variantId,locationId:balance.locationId,kind:"adjust",quantity:-1,reason:"Count correction",reference:"",expectedRevision:null,unitCostMinor:null}).success).toBe(false);
  expect(stockLocationInputSchema.safeParse({name:"Van",kind:"transit",onlineEligible:true,status:"active"}).success).toBe(false);
});
it("normalizes SKU case and rejects injected ownership",()=>{
  const input={productId:"a".repeat(64),sku:"print-01",name:"Print",size:"A4",color:"",material:"Paper",finish:"",priceMinor:2900,currency:"USD",weightGrams:null,fulfillment:"stocked",status:"active"};
  expect(stockVariantInputSchema.parse(input).sku).toBe("PRINT-01");
  expect(stockVariantInputSchema.safeParse({...input,businessId:"other"}).success).toBe(false);
});
