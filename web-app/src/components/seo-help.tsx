import Link from "next/link";
export function SeoHelp() {
  return (
    <section
      className="howto-section"
      id="seo"
      aria-labelledby="seo-help-title"
    >
      <h2 id="seo-help-title">Manage website SEO</h2>
      <p>
        Search engine optimization helps people understand and find the public
        website. A super admin can manage its search title, description, main
        address and search visibility without editing the homepage design.
      </p>
      <ol>
        <li>
          Open{" "}
          <Link href="/admin/settings/seo">
            Workspace settings → Search &amp; sharing settings
          </Link>
          .
        </li>
        <li>
          Enter the <strong>Public site address</strong>: the main HTTPS domain
          already connected to the deployed website. A canonical link tells
          search engines which address is preferred. This setting does not
          register, connect or redirect domains.
        </li>
        <li>
          Write a <strong>Homepage search title</strong> and{" "}
          <strong>Homepage search description</strong>. For example: “Sadboi
          Studios — Original Artwork by Joel Hedstrom” and “Explore original
          artwork and editions by Joel Hedstrom. Browse the gallery, shop
          merchandise, and find upcoming public appearances.” Review the search
          preview.
        </li>
        <li>
          If using Google Search Console HTML-tag verification, paste only its
          content value into <strong>Google verification token</strong>. For a
          fictional tag containing content=&quot;abc123&quot;, enter abc123. DNS
          verification does not need this field.
        </li>
        <li>
          When the public site is ready, select{" "}
          <strong>
            Allow search engines to index the public production site
          </strong>
          , then <strong>Save SEO settings</strong>. Development and preview
          sites remain noindex. Only the configured main production host can opt
          in.
        </li>
        <li>
          In Google Search Console, verify ownership, submit{" "}
          <strong>/sitemap.xml</strong> on your main domain, and use URL
          Inspection for the homepage. Google decides when to crawl, how to
          display the snippet, and where to rank it.
        </li>
      </ol>
      <p>
        Gallery, shop, appearances and contact pages have their own metadata.
        Published artwork uses its public title, description and image. To
        change those, update the artwork and publish it again. Private customer
        and staff pages are excluded, and private notes never enter the sitemap.
      </p>
      <p>
        Uncheck search indexing and save to request removal from search results
        on a later crawl. This does not make public pages private or remove
        cached results immediately. Authentication still protects staff and
        private customer records.
      </p>
      <p>
        Set <strong>Instagram profile</strong> and <strong>X profile</strong> to
        Sadboi’s full HTTPS profile links. These appear below the homepage’s
        main buttons and in the public site header, and identify the artist’s profiles in structured data. The
        X profile also supplies the sharing-card creator. Clear either field and
        save to remove that link. These fields do not connect accounts, embed
        feeds, or post to social media.
      </p>
      <p>
        If a save is interrupted, retry it. If another administrator changed the
        settings, copy any edits you want to keep, choose{" "}
        <strong>Reload saved settings</strong>, then reapply them. Saves are
        versioned and audited. Search engines and social services may cache
        older titles or images.
      </p>
      <p>
        The default sharing image is the supplied Sadboi logo artwork. Use
        View default sharing image in Search &amp; sharing to preview it. Search settings do
        not alter inventory, payments or event publication. Only the social
        profile links affect visible homepage content. Individual product search
        pages and additional per-page overrides are not part of these settings.
      </p>
      <Link className="inline-link" href="#topics">
        Back to tutorial topics ↑
      </Link>
    </section>
  );
}
