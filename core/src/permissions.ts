export type Role = "super_admin" | "legal" | "accounting" | "customer";
export type Capability = "artwork:read" | "artwork:write" | "inventory:read" | "inventory:write"
  | "agreements:read" | "agreements:write" | "finance:read" | "finance:write" | "members:manage";
export type Membership = { userId: string; businessId: string; role: Role; status: "active" | "revoked" };

const grants: Record<Role, readonly Capability[]> = {
  super_admin: ["artwork:read", "artwork:write", "inventory:read", "inventory:write", "agreements:read",
    "agreements:write", "finance:read", "finance:write", "members:manage"],
  legal: ["artwork:read", "agreements:read", "agreements:write"],
  accounting: ["inventory:read", "finance:read", "finance:write"],
  customer: [],
};

// Apply to a server-verified membership, never one supplied by a request body.
export function can(membership: Membership | null, businessId: string, capability: Capability): boolean {
  return membership?.status === "active" && membership.businessId === businessId
    && (grants[membership.role]?.includes(capability) ?? false);
}
