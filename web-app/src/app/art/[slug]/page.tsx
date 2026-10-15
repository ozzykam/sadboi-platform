import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  publicArtwork,
  publicGallery,
  artworkShopLinks,
} from "@/server/gallery";
import { ArtworkViewer } from "@/components/artwork-viewer";
import { GalleryGrid } from "@/components/gallery-grid";
import { publicPageMetadata } from "@/server/seo";
import { cache } from "react";
const artworkForPage = cache(publicArtwork);
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const work = await artworkForPage((await params).slug);
  if (!work) notFound();
  return publicPageMetadata(`/art/${encodeURIComponent(work.slug)}`, {
    title: work.title,
    description:
      work.description.slice(0, 160) ||
      "Original artwork by Joel Hedstrom / Sadboi.",
    image: {
      path: `/api/gallery/images/${encodeURIComponent(work.id)}?w=960`,
      alt: work.alt,
      width: Math.min(work.width, 960),
      height: Math.round(
        (work.height * Math.min(work.width, 960)) / work.width,
      ),
    },
  });
}
export default async function ArtworkPage({ params }: Props) {
  const work = await artworkForPage((await params).slug);
  if (!work) notFound();
  const [all, products] = await Promise.all([
    publicGallery(),
    artworkShopLinks(work.id),
  ]);
  const related = all
    .filter((item) => item.id !== work.id)
    .sort(
      (a, b) =>
        Number(b.series === work.series && !!work.series) -
        Number(a.series === work.series && !!work.series),
    )
    .slice(0, 3);
  const position = all.findIndex((item) => item.id === work.id),
    previous = all[position - 1],
    next = all[position + 1];
  return (
    <main className="gallery-main artwork-detail">
      <Link className="gallery-back" href="/art">
        ← All artwork
      </Link>
      <div className="artwork-detail-layout">
        <figure>
          <ArtworkViewer work={work} />
          {work.caption && <figcaption>{work.caption}</figcaption>}
        </figure>
        <section className="artwork-story">
          <p className="eyebrow">{work.series || "ORIGINAL WORK"}</p>
          <h1>{work.title}</h1>
          <p className="artwork-medium">
            {work.year} / {work.medium}
          </p>
          {work.description && (
            <p className="preserve-lines">{work.description}</p>
          )}
          {!!work.tags.length && (
            <div className="artwork-tags">
              {work.tags.map((tag) => (
                <Link key={tag} href={`/art?q=${encodeURIComponent(tag)}`}>
                  {tag}
                </Link>
              ))}
            </div>
          )}
          {work.credits && (
            <section className="artwork-credits">
              <h2>Credits</h2>
              <p className="preserve-lines">{work.credits}</p>
            </section>
          )}
          {!!products.length && (
            <section className="artwork-shop-links">
              <h2>From this work</h2>
              {products.map((product) => (
                <Link key={product.id} href={`/shop/${product.id}`}>
                  {product.title} <span aria-hidden="true">↗</span>
                </Link>
              ))}
            </section>
          )}
        </section>
      </div>
      <nav className="artwork-pagination" aria-label="Browse artwork">
        {previous ? (
          <Link href={`/art/${previous.slug}`}>← {previous.title}</Link>
        ) : (
          <span />
        )}
        {next && <Link href={`/art/${next.slug}`}>{next.title} →</Link>}
      </nav>
      {!!related.length && (
        <section className="gallery-related">
          <h2>More from the studio</h2>
          <GalleryGrid works={related} />
        </section>
      )}
    </main>
  );
}
