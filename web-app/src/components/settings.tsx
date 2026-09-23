"use client";

import { useState, type ChangeEvent } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  Database,
  FlaskConical,
  LockKeyhole,
  RotateCcw,
} from "lucide-react";
import { emptyCatalog, sampleCatalog } from "@sadboi/core";
import { exportDrafts, replaceDrafts, useDrafts } from "@/lib/draft-store";
import { Badge, Button, PageHeading } from "./ui";

export function Settings() {
  const { catalog } = useDrafts();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  function run(action: () => void, success: string) {
    try {
      action();
      setError("");
      setMessage(success);
    } catch (error) {
      setMessage("");
      setError(
        error instanceof Error
          ? error.message
          : "This action could not be completed.",
      );
    }
  }
  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 2_000_000)
        throw new Error("Choose a preview export smaller than 2 MB.");
      const data: unknown = JSON.parse(await file.text());
      if (
        catalog.artworks.length &&
        !window.confirm(
          "Replace this browser's preview with the imported catalog? Export first if you want to keep it.",
        )
      )
        return;
      run(() => replaceDrafts(data), "Preview restored from your file.");
    } catch {
      setMessage("");
      setError(
        "The file could not be imported. Use a valid Sadboi preview export under 2 MB.",
      );
    } finally {
      event.target.value = "";
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="WORKSPACE / FOUNDATION"
        title="A considered beginning."
        description="What works now, where drafts live, and what we connect next."
      />
      <div className="settings-grid">
        <section className="settings-panel">
          <FlaskConical size={25} strokeWidth={1.4} />
          <h2>Your local preview</h2>
          <p>
            Artwork drafts save in this browser on this device. They are not
            shared with Joel, backed up to the cloud, or protected by a staff
            login yet. Use fictional or non-sensitive information here.
          </p>
          <div className="settings-actions">
            <Button
              variant="secondary"
              onClick={() => run(exportDrafts, "Preview export downloaded.")}
            >
              <ArrowDownToLine size={16} />
              Export drafts
            </Button>
            <label className="button secondary file-label">
              <ArrowUpFromLine size={16} />
              Import drafts
              <input
                type="file"
                accept="application/json,.json"
                onChange={importFile}
              />
            </label>
          </div>
          <hr />
          <h3>Try a connected catalog</h3>
          <p>
            Load three fictional artworks, two print variants, and stock at a
            studio and gallery. No real artwork, prices, or stock are implied.
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              if (
                catalog.artworks.length &&
                !window.confirm(
                  "Replace existing local drafts with the sample catalog? Export first to keep your drafts.",
                )
              )
                return;
              run(
                () => replaceDrafts(sampleCatalog()),
                "Fictional sample catalog loaded. Open Artwork or Inventory to explore it.",
              );
            }}
          >
            Load sample catalog
          </Button>
          <div className="reset-row">
            <Button
              variant="ghost"
              onClick={() => {
                if (
                  window.confirm(
                    "Clear the local preview? This only removes drafts from this browser. Export first to keep them.",
                  )
                )
                  run(
                    () => replaceDrafts(emptyCatalog),
                    "Local preview cleared.",
                  );
              }}
            >
              <RotateCcw size={15} />
              Reset local preview
            </Button>
          </div>
        </section>
        <div>
          <section className="settings-panel">
            <Database size={24} strokeWidth={1.4} />
            <h2>Connection status</h2>
            <div className="provider-row">
              <span>Artwork preview</span>
              <Badge tone="green">Local</Badge>
            </div>
            <div className="provider-row">
              <span>Firebase & shared storage</span>
              <Badge>Not connected</Badge>
            </div>
            <div className="provider-row">
              <span>Stripe & event POS</span>
              <Badge>Not connected</Badge>
            </div>
            <div className="provider-row">
              <span>Email & shipping</span>
              <Badge>Not connected</Badge>
            </div>
            <p className="field-hint">
              No credentials or settings from your existing projects are used.
            </p>
          </section>
          <section className="settings-panel">
            <LockKeyhole size={23} strokeWidth={1.4} />
            <h2>Shared access comes next</h2>
            <p>
              The planned account model gives you and Joel full studio access,
              with scoped invitations for legal and accounting work.
            </p>
            <p>
              Live dashboard access stays locked until verified authentication
              and secure storage are implemented.
            </p>
            <span className="status-note">
              <Check size={15} />
              Domain permission policy defined
            </span>
          </section>
        </div>
      </div>
      {message && (
        <div className="notice success" role="status">
          {message}
        </div>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
    </>
  );
}
