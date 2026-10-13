import Link from "next/link";
import type { PublicArtwork } from "@sadboi/core";
import { CatalogImage } from "./catalog-image";
export function GalleryGrid({ works }: { works: PublicArtwork[] }) {
  return (
    <div className="gallery-grid">
      {works.map((work) => (
        <article key={work.id} className="gallery-card">
          <Link href={`/art/${work.slug}`} className="gallery-card-link">
            <div className="gallery-card-image">
              <CatalogImage
                variant="art"
                src={`/api/gallery/images/${work.id}?w=960`}
                srcSet={`/api/gallery/images/${work.id}?w=480 480w, /api/gallery/images/${work.id}?w=960 960w, /api/gallery/images/${work.id}?w=1600 1600w`}
                sizes="(max-width: 600px) 90vw, (max-width: 1000px) 43vw, 28vw"
                width={work.width}
                height={work.height}
                alt={work.alt}
              />
            </div>
            <div className="gallery-card-caption">
              <h2>{work.title}</h2>
              <span>{work.year}</span>
            </div>
            <p>{work.series || work.medium}</p>
          </Link>
        </article>
      ))}
    </div>
  );
}
