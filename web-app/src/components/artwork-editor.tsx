"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowUpRight, Check, Save } from "lucide-react";
import {
  artworkInputSchema,
  type Artwork,
  type ArtworkInput,
} from "@sadboi/core";
import { saveDraft, useDrafts } from "@/lib/draft-store";
import { ArtworkMark, Badge, Button, Input, PageHeading } from "./ui";

export function ArtworkEditor({ id }: { id?: string }) {
  const { catalog, ready, error } = useDrafts();
  if (!ready)
    return (
      <p className="loading-state" role="status">
        Opening artwork…
      </p>
    );
  if (error)
    return (
      <p className="notice error">
        Resolve the saved preview issue in Workspace before editing.
      </p>
    );
  const artwork = catalog.artworks.find((art) => art.id === id);
  if (id && !artwork)
    return (
      <div className="empty-state">
        <h1>Artwork not found.</h1>
        <p>
          This record may have been removed in another tab or a different
          browser.
        </p>
        <Link className="button secondary" href="/admin/artworks">
          Return to artwork
        </Link>
      </div>
    );
  return (
    <ArtworkForm
      artwork={artwork}
      key={id ?? "new"}
      variants={catalog.variants.filter((v) => v.artworkId === id).length}
    />
  );
}

export function ArtworkForm({
  artwork,
  variants,
  onSave,
}: {
  artwork?: Artwork;
  variants: number;
  onSave?: (input: ArtworkInput) => Promise<void>;
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSaved(false);
    const form = new FormData(event.currentTarget);
    const string = (name: string) => String(form.get(name) ?? "");
    const dimension = (name: string) =>
      string(name).trim() ? Number(string(name)) : null;
    const result = artworkInputSchema.safeParse({
      title: string("title"),
      series: string("series"),
      year: Number(string("year")),
      medium: string("medium"),
      description: string("description"),
      status: string("status"),
      rights: string("rights"),
      tags: [
        ...new Set(
          string("tags")
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        ),
      ],
      pixelWidth: dimension("pixelWidth"),
      pixelHeight: dimension("pixelHeight"),
      colorProfile: string("colorProfile"),
      internalNotes: string("internalNotes"),
    });
    if (!result.success) {
      const fields: Record<string, string> = {};
      for (const issue of result.error.issues)
        fields[String(issue.path[0])] ??= issue.message;
      setErrors(fields);
      setMessage("Check the highlighted details before saving.");
      const first = event.currentTarget.elements.namedItem(
        Object.keys(fields)[0],
      );
      if (first instanceof HTMLElement) first.focus();
      return;
    }
    setSaving(true);
    try {
      if (onSave) await onSave(result.data);
      else {
        const id = saveDraft(result.data, artwork?.id);
        if (!artwork) router.replace(`/admin/artworks/${id}`);
      }
      setErrors({});
      setDirty(false);
      setSaved(true);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The artwork could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Link
        className="back-link"
        href="/admin/artworks"
        onClick={(event) => {
          if (dirty && !window.confirm("Leave without saving these changes?"))
            event.preventDefault();
        }}
      >
        <ArrowLeft size={16} />
        All artwork
      </Link>
      <PageHeading
        eyebrow={artwork ? "ARTWORK / DETAILS" : "ARTWORK / NEW RECORD"}
        title={artwork ? artwork.title : "Give the work a home."}
        description="Keep the original work separate from the products and editions it becomes."
      />
      <form
        onSubmit={submit}
        noValidate
        onChange={() => {
          setDirty(true);
          setSaved(false);
        }}
        className="editor-layout"
      >
        <fieldset disabled={saving} className="editor-fields">
          <div className="editor-main">
            <section className="form-section">
              <div className="form-section-heading">
                <span>01</span>
                <div>
                  <h2>The work</h2>
                  <p>Its identity, context, and story.</p>
                </div>
              </div>
              <Input
                name="title"
                label="Artwork title"
                required
                maxLength={160}
                defaultValue={artwork?.title ?? ""}
                placeholder="A title for this piece"
                error={errors.title}
              />
              <div className="field-grid">
                <Input
                  name="series"
                  label="Series or collection"
                  maxLength={120}
                  defaultValue={artwork?.series ?? ""}
                  placeholder="Optional"
                  error={errors.series}
                />
                <Input
                  name="year"
                  label="Year created"
                  type="number"
                  min={1000}
                  max={9999}
                  required
                  defaultValue={artwork?.year ?? new Date().getFullYear()}
                  error={errors.year}
                />
              </div>
              <Input
                name="medium"
                label="Medium / technique"
                required
                maxLength={120}
                defaultValue={artwork?.medium ?? "Digital painting"}
                error={errors.medium}
              />
              <div className="field">
                <label htmlFor="description">The story behind it</label>
                <textarea
                  id="description"
                  name="description"
                  rows={5}
                  maxLength={5000}
                  defaultValue={artwork?.description ?? ""}
                  placeholder="Concept, inspiration, or a description of the work."
                />
                <p className="field-hint">
                  Publishing to the gallery shares this saved description.
                </p>
              </div>
              <Input
                name="tags"
                label="Tags"
                defaultValue={artwork?.tags.join(", ") ?? ""}
                placeholder="mythology, portrait, study"
                helperText="Separate tags with commas. Up to 20 tags."
                error={errors.tags}
              />
            </section>
            <section className="form-section">
              <div className="form-section-heading">
                <span>02</span>
                <div>
                  <h2>Original specifications</h2>
                  <p>
                    The digital master, before print sizes or product variants.
                  </p>
                </div>
              </div>
              <div className="field-grid">
                <Input
                  name="pixelWidth"
                  label="Width (pixels)"
                  type="number"
                  min={1}
                  max={100000}
                  defaultValue={artwork?.pixelWidth ?? ""}
                  placeholder="e.g. 4800"
                  error={errors.pixelWidth}
                />
                <Input
                  name="pixelHeight"
                  label="Height (pixels)"
                  type="number"
                  min={1}
                  max={100000}
                  defaultValue={artwork?.pixelHeight ?? ""}
                  placeholder="e.g. 6000"
                  error={errors.pixelHeight}
                />
              </div>
              <Input
                name="colorProfile"
                label="Color profile"
                maxLength={100}
                defaultValue={artwork?.colorProfile ?? ""}
                placeholder="e.g. sRGB IEC61966-2.1"
                error={errors.colorProfile}
              />
            </section>
            <section className="form-section">
              <div className="form-section-heading">
                <span>03</span>
                <div>
                  <h2>Studio notes</h2>
                  <p>Details for you and the artist.</p>
                </div>
              </div>
              <div className="field">
                <label htmlFor="notes">Internal notes</label>
                <textarea
                  id="notes"
                  name="internalNotes"
                  rows={4}
                  maxLength={5000}
                  defaultValue={artwork?.internalNotes ?? ""}
                  placeholder={
                    onSave
                      ? "Private notes for you and Joel."
                      : "Keep this preview non-sensitive."
                  }
                />
              </div>
            </section>
            <div className="save-bar">
              {message ? (
                <p role="alert" className="field-error">
                  {message}
                </p>
              ) : (
                <p role="status">
                  {saved ? (
                    <>
                      <Check size={16} />
                      {onSave
                        ? "Saved to the shared studio"
                        : "Saved in this browser"}
                    </>
                  ) : onSave ? (
                    "Save studio details, then use Public gallery below to publish changes"
                  ) : (
                    "Local draft - nothing is published"
                  )}
                </p>
              )}
              <Button type="submit" loading={saving}>
                <Save size={16} />
                Save artwork
              </Button>
            </div>
          </div>
          <aside className="editor-aside">
            {!onSave && <ArtworkMark title={artwork?.title ?? "S"} large />}
            <p className="aside-caption">
              {onSave
                ? "Original images and private previews are managed below."
                : "Image uploads are available in the shared studio."}
            </p>
            {onSave && artwork && (
              <a
                href={`/admin/artworks/${artwork.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-link"
              >
                Open saved version in a new tab
              </a>
            )}
            <div className="aside-section">
              <h2>Catalog status</h2>
              <div className="field">
                <label htmlFor="status">Workspace status</label>
                <select
                  id="status"
                  name="status"
                  defaultValue={artwork?.status ?? "draft"}
                >
                  <option value="draft">Draft</option>
                  <option value="ready">Ready for review</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <p className="field-hint">Ready does not publish the artwork.</p>
              <div className="field">
                <label htmlFor="rights">Rights classification</label>
                <select
                  id="rights"
                  name="rights"
                  defaultValue={artwork?.rights ?? "review"}
                >
                  <option value="review">Needs review</option>
                  <option value="owned">Artist owned</option>
                  <option value="licensed">Licensed work</option>
                </select>
              </div>
              <p className="field-hint">
                Track rights before offering prints or licensing a work.
              </p>
            </div>
            {artwork && !onSave && (
              <div className="aside-section">
                <h2>Connected to this work</h2>
                <p className="connection-row">
                  Print variants <Badge>{variants}</Badge>
                </p>
                <Link className="text-link" href="/admin/inventory">
                  View inventory <ArrowUpRight size={15} />
                </Link>
                <small className="record-id">RECORD / {artwork.id}</small>
              </div>
            )}
          </aside>
        </fieldset>
      </form>
    </>
  );
}
