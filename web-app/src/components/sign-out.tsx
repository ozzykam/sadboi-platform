"use client";
import { useState } from "react";
import { sessionRequest } from "@/lib/firebase-client";
export function SignOut() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function leave() {
    setBusy(true);
    setError("");
    try {
      const response = await sessionRequest("DELETE", {});
      if (!response.ok) throw new Error();
      // Full navigation discards cached staff pages when the session changes.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/sign-in");
    } catch {
      setError("Sign-out failed. Please retry.");
      setBusy(false);
    }
  }
  return (
    <div>
      <button
        type="button"
        className="button secondary"
        onClick={leave}
        disabled={busy}
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
