import "server-only";
export function getMode(): "preview" | "locked" | "staff" {
  const mode =
    process.env.SADBOI_MODE ??
    (process.env.NODE_ENV === "development" ? "preview" : "locked");
  if (!["preview", "locked", "staff"].includes(mode))
    throw new Error("SADBOI_MODE must be preview, locked, or staff.");
  if (mode === "preview" && process.env.NODE_ENV === "production")
    throw new Error("Preview mode is development-only.");
  return mode as "preview" | "locked" | "staff";
}
