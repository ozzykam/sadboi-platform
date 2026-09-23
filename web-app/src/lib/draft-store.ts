"use client";

import { useSyncExternalStore } from "react";
import {
  emptyCatalog,
  parsePreviewCatalog,
  saveArtworkDraft,
  type ArtworkInput,
  type Catalog,
} from "@sadboi/core";

const KEY = "sadboi.catalog-preview.v1";
type Snapshot = { catalog: Catalog; error: string | null; ready: boolean };
const serverSnapshot: Snapshot = {
  catalog: emptyCatalog,
  error: null,
  ready: false,
};
let cached: Snapshot = serverSnapshot;
let rawCache: string | null | undefined;
const listeners = new Set<() => void>();

function getSnapshot(): Snapshot {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (cached.ready && raw === rawCache) return cached;
    rawCache = raw;
    cached = {
      catalog: raw ? parsePreviewCatalog(JSON.parse(raw)) : emptyCatalog,
      error: null,
      ready: true,
    };
  } catch {
    if (!cached.error)
      cached = {
        catalog: emptyCatalog,
        ready: true,
        error:
          "Your saved preview could not be opened. Export the saved file before resetting, or restore a valid preview export.",
      };
  }
  return cached;
}

function emit() {
  for (const listener of listeners) listener();
}
function onStorage(event: StorageEvent) {
  if (event.key === KEY || event.key === null) emit();
}
function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

export function useDrafts(): Snapshot {
  return useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);
}

export function replaceDrafts(value: unknown) {
  const catalog = parsePreviewCatalog(value);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(catalog));
  } catch {
    throw new Error(
      "This browser could not save the preview. Check available storage and browser permissions.",
    );
  }
  rawCache = undefined;
  cached = { catalog, error: null, ready: true };
  emit();
}

export function saveDraft(input: ArtworkInput, id?: string) {
  const current = getSnapshot();
  if (current.error) throw new Error(current.error);
  if (id && !current.catalog.artworks.some((art) => art.id === id))
    throw new Error("This artwork no longer exists. Reload the catalog.");
  const recordId = id ?? crypto.randomUUID();
  replaceDrafts(
    saveArtworkDraft(
      current.catalog,
      input,
      recordId,
      new Date().toISOString(),
    ),
  );
  return recordId;
}

export function exportDrafts() {
  const snapshot = getSnapshot();
  const raw = snapshot.error
    ? window.localStorage.getItem(KEY)
    : JSON.stringify(snapshot.catalog, null, 2);
  if (!raw) throw new Error("There is no saved file to export.");
  const url = URL.createObjectURL(
    new Blob([raw], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "sadboi-catalog-preview.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
