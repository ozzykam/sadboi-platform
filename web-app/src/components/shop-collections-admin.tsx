"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, X } from "lucide-react";
import type { ShopCollectionInput, ShopCollectionRecord } from "@sadboi/core";
import { artworkRequest } from "@/lib/artwork-client";
type Choice = { id: string; title: string };
const blank = (): ShopCollectionInput => ({
  title: "",
  description: "",
  order: 0,
  productIds: [],
  artworkIds: [],
});

export function ShopCollectionsAdmin({
  initial,
  products,
  works,
}: {
  initial: ShopCollectionRecord[];
  products: Choice[];
  works: Choice[];
}) {
  const [records, setRecords] = useState(initial),
    [record, setRecord] = useState<ShopCollectionRecord | null>(null);
  const [input, setInput] = useState<ShopCollectionInput>(blank),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    lock = useRef(false),
    attempt = useRef({ payload: "", id: "" });
  const dirty =
    JSON.stringify(input) !== JSON.stringify(record?.input ?? blank());
  useEffect(() => {
    if (!open || !dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [open, dirty]);
  function edit(next: ShopCollectionRecord | null) {
    setRecord(next);
    setInput(next?.input ?? blank());
    setError("");
    setMessage("");
    attempt.current = { payload: "", id: "" };
    setOpen(true);
    dialog.current?.showModal();
  }
  function close() {
    if (
      busy ||
      (dirty && !window.confirm("Discard unsaved collection changes?"))
    )
      return;
    dialog.current?.close();
    setOpen(false);
  }
  async function save(
    action: "save" | "publish" | "unpublish" | "archive" | "restore",
  ) {
    if (lock.current || (action !== "save" && (!record || dirty))) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    const body = {
      action,
      id: record?.id ?? null,
      revision: record?.revision ?? 0,
      ...(action === "save" ? { input } : {}),
    };
    const payload = JSON.stringify(body);
    if (attempt.current.payload !== payload)
      attempt.current = { payload, id: crypto.randomUUID() };
    try {
      const result: { collection: ShopCollectionRecord } = await artworkRequest(
        "/api/shop-collections",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, operationId: attempt.current.id }),
        },
      );
      setRecord(result.collection);
      setInput(result.collection.input);
      setRecords((current) => [
        result.collection,
        ...current.filter((item) => item.id !== result.collection.id),
      ]);
      attempt.current = { payload: "", id: "" };
      setMessage(
        action === "save"
          ? "Draft saved. Publish collection to show these changes publicly."
          : action === "publish"
            ? "Collection published."
            : action === "archive"
              ? "Collection archived and removed from the shop."
              : action === "restore"
                ? "Collection restored as a draft."
                : "Collection unpublished. Your draft is kept.",
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not save. Keep this dialog open and retry the same action.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function move(
    field: "productIds" | "artworkIds",
    index: number,
    direction: number,
  ) {
    setInput((current) => {
      const ids = [...current[field]];
      [ids[index], ids[index + direction]] = [
        ids[index + direction],
        ids[index],
      ];
      return { ...current, [field]: ids };
    });
  }
  function members(
    field: "productIds" | "artworkIds",
    choices: Choice[],
    label: string,
  ) {
    const ids = input[field],
      selected = new Set(ids);
    return (
      <section className="collection-members">
        <h3>{label}</h3>
        <label>
          Add {label.toLowerCase()}
          <select
            value=""
            disabled={busy || record?.archived || ids.length >= 100}
            onChange={(event) => {
              const id = event.target.value;
              if (id)
                setInput((current) => ({
                  ...current,
                  [field]: [...current[field], id],
                }));
            }}
          >
            <option value="">Choose a published item…</option>
            {choices
              .filter((item) => !selected.has(item.id))
              .map((item) => (
                <option value={item.id} key={item.id}>
                  {item.title}
                </option>
              ))}
          </select>
        </label>
        {!ids.length && (
          <p className="field-hint">No {label.toLowerCase()} selected.</p>
        )}
        <ol>
          {ids.map((id, index) => {
            const item = choices.find((choice) => choice.id === id),
              title =
                item?.title ??
                "Unavailable item — remove or publish it separately";
            return (
              <li key={id}>
                <span>{title}</span>
                <div className="collection-member-actions">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Move ${title} up`}
                    disabled={busy || record?.archived || index === 0}
                    onClick={() => move(field, index, -1)}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Move ${title} down`}
                    disabled={
                      busy || record?.archived || index === ids.length - 1
                    }
                    onClick={() => move(field, index, 1)}
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove ${title} from collection`}
                    disabled={busy || record?.archived}
                    onClick={() =>
                      setInput((current) => ({
                        ...current,
                        [field]: current[field].filter((value) => value !== id),
                      }))
                    }
                  >
                    <X size={16} />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    );
  }
  const visible = records
    .filter((item) => includeArchived || !item.archived)
    .sort(
      (a, b) =>
        a.input.order - b.input.order ||
        a.input.title.localeCompare(b.input.title),
    );
  return (
    <>
      <div className="collection-admin-heading">
        <div>
          <p className="eyebrow">SHOP / COLLECTIONS</p>
          <h1>Curate a collection.</h1>
          <p className="subtitle">
            Group published products and artwork, arrange their order, then
            publish when ready.
          </p>
          <Link href="/admin/how-to#collections" className="inline-link">
            How to manage collections
          </Link>
        </div>
        <button
          className="button primary"
          type="button"
          onClick={() => edit(null)}
        >
          <Plus size={16} /> New collection
        </button>
      </div>
      <label className="collection-archive-filter">
        <input
          type="checkbox"
          checked={includeArchived}
          onChange={(event) => setIncludeArchived(event.target.checked)}
        />{" "}
        Include archived collections
      </label>
      <div className="table-scroll inbox-table-wrap">
        <table className="inbox-table collections-table">
          <thead>
            <tr>
              <th>Collection</th>
              <th>Contents</th>
              <th>Visibility</th>
              <th>Order</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.input.title}</strong>
                </td>
                <td>
                  {item.input.productIds.length} products ·{" "}
                  {item.input.artworkIds.length} artworks
                </td>
                <td>
                  {item.archived
                    ? "Archived"
                    : item.published
                      ? item.revision === item.publishedRevision
                        ? "Published"
                        : "Published · draft changes"
                      : "Draft"}
                </td>
                <td>{item.input.order}</td>
                <td>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => edit(item)}
                  >
                    <Pencil size={14} /> Edit
                  </button>
                  {item.published && (
                    <Link
                      className="inline-link"
                      href={`/shop/collections/${item.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View public page ↗
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td colSpan={5}>
                  No collections yet. Create one to group a series, theme or
                  release.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <dialog
        ref={dialog}
        className="contact-detail-dialog collection-editor"
        aria-labelledby="collection-editor-title"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
      >
        <h2 id="collection-editor-title">
          {record ? record.input.title : "New collection"}
        </h2>
        <p className="field-hint">
          Save draft keeps changes private. Publish collection applies the saved
          title, description and item order to the public page.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save("save");
          }}
        >
          <fieldset disabled={busy || record?.archived}>
            <label>
              Collection name
              <input
                required
                minLength={3}
                maxLength={160}
                value={input.title}
                onChange={(event) =>
                  setInput({ ...input, title: event.target.value })
                }
              />
            </label>
            <label>
              Description
              <textarea
                rows={4}
                maxLength={3000}
                value={input.description}
                onChange={(event) =>
                  setInput({ ...input, description: event.target.value })
                }
              />
            </label>
            <label>
              Collection display order
              <input
                type="number"
                min={0}
                max={999999}
                step={1}
                required
                value={input.order}
                onChange={(event) =>
                  setInput({ ...input, order: Number(event.target.value) })
                }
              />
            </label>
            <p className="field-hint">
              Lower numbers appear first in the shop. Products and artwork each
              follow the order below.
            </p>
            {members("productIds", products, "Products")}
            {members("artworkIds", works, "Artwork")}
            <button
              className="button primary"
              type="submit"
              disabled={!dirty && !!record}
            >
              {busy ? "Saving…" : "Save draft"}
            </button>
          </fieldset>
        </form>
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
        {dirty && (
          <p className="field-hint">
            Save or discard your draft edits before publishing, unpublishing or
            archiving.
          </p>
        )}
        <div className="collection-editor-actions">
          {record && !record.archived && (
            <>
              <button
                className="button primary"
                type="button"
                disabled={busy || dirty}
                onClick={() => void save("publish")}
              >
                {record.published
                  ? "Update published collection"
                  : "Publish collection"}
              </button>
              {record.published && (
                <button
                  className="button secondary"
                  type="button"
                  disabled={busy || dirty}
                  onClick={() => void save("unpublish")}
                >
                  Unpublish
                </button>
              )}
              <button
                className="button secondary"
                type="button"
                disabled={busy || dirty}
                onClick={() => void save("archive")}
              >
                Archive collection
              </button>
            </>
          )}
          {record?.archived && (
            <button
              className="button secondary"
              type="button"
              disabled={busy}
              onClick={() => void save("restore")}
            >
              Restore draft
            </button>
          )}
          <button
            className="button secondary"
            type="button"
            disabled={busy}
            onClick={close}
          >
            Close
          </button>
        </div>
      </dialog>
    </>
  );
}
