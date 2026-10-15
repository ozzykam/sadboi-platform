"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import {
  seoInputSchema,
  type SeoSettings as Settings,
  type SeoInput,
} from "@sadboi/core";
import { inventoryRequest } from "@/lib/inventory-client";
import { Button, Input, Textarea, PageHeading } from "./ui";

export function SeoSettings({
  initial,
  production,
}: {
  initial: Settings;
  production: boolean;
}) {
  const [saved, setSaved] = useState(initial);
  const [input, setInput] = useState(initial.input);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const attempt = useRef<{ fingerprint: string; operationId: string } | null>(
    null,
  );
  const dirty = JSON.stringify(input) !== JSON.stringify(saved.input);
  function change<K extends keyof SeoInput>(key: K, value: SeoInput[K]) {
    setInput((current) => ({ ...current, [key]: value }));
    setMessage("");
    setError("");
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    const parsed = seoInputSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues.map((issue) => issue.message).join(" "));
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    const body = { input: parsed.data, expectedRevision: saved.revision };
    const fingerprint = JSON.stringify(body);
    if (attempt.current?.fingerprint !== fingerprint)
      attempt.current = { fingerprint, operationId: crypto.randomUUID() };
    try {
      const result: Settings = await inventoryRequest("/api/seo", {
        method: "POST",
        body: JSON.stringify({
          ...body,
          operationId: attempt.current.operationId,
        }),
      });
      setSaved(result);
      setInput(result.input);
      attempt.current = null;
      setMessage(
        "SEO settings saved. Search engines and social platforms may take time to refresh their copies.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save. Retry your changes.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function reload() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result: Settings = await inventoryRequest("/api/seo");
      setSaved(result);
      setInput(result.input);
      attempt.current = null;
      setMessage("Loaded the latest saved settings.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not load settings.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link href="/admin/settings" className="inline-link">
        ← Workspace settings
      </Link>
      <PageHeading
        eyebrow="SETTINGS / WEBSITE"
        title="Search & sharing"
        description="Control how the public website introduces itself in search results and shared links."
      />
      <p>
        <Link href="/admin/how-to#seo" className="inline-link">
          How to manage website SEO
        </Link>
      </p>
      <p className="notice">
        Saved search visibility:{" "}
        <strong>
          {saved.input.indexingEnabled
            ? "Enabled for the canonical production site"
            : "Hidden from search indexing"}
        </strong>
        .
        {!production &&
          " This development or preview deployment stays hidden regardless of the saved setting."}
      </p>
      <form onSubmit={save} className="seo-settings-form">
        <fieldset disabled={busy} className="seo-settings-fields">
          <legend>Public website settings</legend>
          <Input
            label="Public site address"
            type="url"
            value={input.siteUrl}
            onChange={(event) => change("siteUrl", event.target.value)}
            maxLength={253}
            placeholder="https://your-domain.com"
            helperText="The main HTTPS address visitors should use. Leave off page paths. This sets canonical links; it does not connect or redirect a domain."
          />
          <Input
            label="Homepage search title"
            value={input.homeTitle}
            onChange={(event) => change("homeTitle", event.target.value)}
            required
            minLength={10}
            maxLength={120}
            helperText={`${input.homeTitle.length} characters. Aim for a concise, descriptive title; search engines may shorten it.`}
          />
          <Textarea
            label="Homepage search description"
            value={input.homeDescription}
            onChange={(event) => change("homeDescription", event.target.value)}
            required
            minLength={40}
            maxLength={320}
            rows={4}
            helperText={`${input.homeDescription.length} characters. Summarize what visitors will find. Around 140–160 characters is a useful starting point, not a ranking rule.`}
          />
          <Input
            label="Google verification token (optional)"
            value={input.googleVerification}
            onChange={(event) =>
              change("googleVerification", event.target.value)
            }
            maxLength={200}
            helperText="For Search Console's HTML-tag verification, paste only the content value. Leave blank if you verify through DNS."
          />
          <Input
            label="Instagram profile"
            type="url"
            value={input.instagramUrl}
            onChange={(event) => change("instagramUrl", event.target.value)}
            maxLength={200}
            helperText="Shown on the homepage and linked to the artist in structured data. Clear to hide."
          />
          <Input
            label="X profile"
            type="url"
            value={input.xUrl}
            onChange={(event) => change("xUrl", event.target.value)}
            maxLength={200}
            helperText="Shown on the homepage and used for the X sharing-card creator. Clear to hide."
          />
          <label className="seo-indexing-toggle">
            <input
              type="checkbox"
              checked={input.indexingEnabled}
              onChange={(event) =>
                change("indexingEnabled", event.target.checked)
              }
            />{" "}
            Allow search engines to index the public production site
          </label>
          <p className="field-hint">
            This applies to the homepage, gallery and published artwork, shop,
            appearances, and contact page. Staff pages, private customer links,
            cart and checkout stay excluded.
          </p>
        </fieldset>
        <section
          className="seo-search-preview"
          aria-labelledby="seo-preview-title"
        >
          <h2 id="seo-preview-title">Search result preview</h2>
          <p className="field-hint">
            Illustration only. Search engines choose the final wording and
            layout.
          </p>
          <p className="seo-preview-url">
            {input.siteUrl || "Your public site address"}
          </p>
          <p className="seo-preview-title">{input.homeTitle}</p>
          <p>{input.homeDescription}</p>
        </section>
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
        <div className="actions">
          <Button type="submit" loading={busy} disabled={!dirty}>
            Save SEO settings
          </Button>
          <Button variant="secondary" disabled={busy} onClick={reload}>
            Reload saved settings
          </Button>
        </div>
        <p className="field-hint">
          Reload saved settings discards unsaved edits. After an uncertain save,
          retry Save SEO settings before reloading.
        </p>
      </form>
      <section className="seo-settings-tools">
        <h2>Check the published result</h2>
        <p>
          Public pages receive their own titles, descriptions, canonical links
          and social previews. The homepage also identifies the website and
          artist with structured data. Social profiles also appear as homepage
          links.
        </p>
        <p>
          <Link href="/robots.txt" target="_blank" rel="noopener">
            View robots.txt
          </Link>
          {" · "}
          <Link href="/sitemap.xml" target="_blank" rel="noopener">
            View sitemap
          </Link>
          {" · "}
          <Link href="/images/shared-image.webp" target="_blank" rel="noopener">
            View default sharing image
          </Link>
        </p>
        <p>
          The sitemap lists public pages and published artwork only when
          indexing is enabled on the canonical production host. It stays empty
          on local and preview sites.
        </p>
        <p>
          <a
            href="https://search.google.com/search-console"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open Google Search Console
          </a>{" "}
          to verify your domain, submit its sitemap, and inspect indexing.
          Saving here does not submit the site to Google or guarantee a ranking.
        </p>
      </section>
    </>
  );
}
