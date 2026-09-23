# Public gallery and shared navigation

The gallery at `/art` presents all published artwork independently of product availability. Each piece has a stable `/art/[slug]` page with story, year, medium, series, tags, caption, credits, an accessible enlarged image viewer, previous/next navigation, related artwork, and optional links to public products. Search matches titles, series, and tags; series and medium filters work through URL parameters.

The shared public navbar uses the shop's landscape logo, height, colors, and layout, with Gallery, Shop, Staff/Client Login, and cart count. The logo links home. The homepage retains its own header, and `/admin` retains staff navigation. On small screens login uses a labeled icon. Cart opens in the shop and restores the existing local cart; the server still validates checkout independently.

## Publish a piece

Super admins open a saved artwork and use **Public gallery**, after uploading an image under **Originals & previews**. Choose the image, enter visual alt text, optional caption/credits, and display order, then confirm public-display permission. **Publish to gallery** requires Ready for review status and resolved rights (owned or licensed). It does not require a product or stock.

Save artwork details before publishing. Publication snapshots the saved title, story, year, medium, series, and tags; **Update gallery** applies subsequent saved changes. New uploads never silently replace the public image. Lower display-order numbers come first, then newest year, title, and ID.

**Unpublish** removes public page/list/image access and preserves the studio record and files. Saving Draft, Archived, or Needs review also withdraws it in the same transaction. Restoring Ready does not republish automatically. Title changes preserve the first public slug.

The in-app tutorial is `/admin/how-to#gallery` and is linked from the publishing panel.

## Boundaries and recovery

- Publishing requires current super-admin authorization, same-origin CSRF, strict input validation, and a matching artwork revision. Successful publication increments the revision and writes an audit event atomically with the public snapshot.
- Immediate retries of the same publication operation do not duplicate revisions or events. Stale requests cannot overwrite newer metadata/publication, including after archival. Keep the form open after uncertain saves; resolve version conflicts against the latest saved record.
- `businesses/sadboi/gallery/{artworkId}` stores the explicit public projection and selected asset ID. Public pages never serialize studio notes, private object paths, original filenames, hashes, or staff identities.
- Display images use the existing stripped, orientation-corrected WebP preview, capped at a 1600px edge. The public image route only serves the currently selected image of a published record, in bounded 480/960/1600px widths. It never serves original bytes or accepts object paths.
- Public page/image responses are dynamic; gallery images use no-store to avoid serving a withdrawn image from the application cache. Already downloaded images cannot be recalled.
- Firestore/Storage client rules remain private; application routes mediate access. No private artwork is auto-published and no live business records are changed by the test suite.
- Public archive reads are batched without a silent record cap. The initial gallery is server-rendered; a very large archive may later need paginated search.

## Verification

`pnpm check` runs type checking, lint, domain tests, Firebase credential tests, and a production build. `pnpm test:gallery` runs existing artwork/authentication coverage plus gallery publication, privacy, filters, stable URLs, product links, retries, archival, and withdrawal checks against disposable emulators.

## Remaining scope

One public image per work; manual publication only. Multi-image stories, scheduling, separate curated collection pages, and a fuller featured-work homepage remain future slices. Existing site-wide noindex settings remain unchanged. The login link uses the existing sign-in route; a client portal is still separate planned work.
