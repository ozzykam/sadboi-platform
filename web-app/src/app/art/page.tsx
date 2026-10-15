import { publicPageMetadata } from "@/server/seo";
import Link from "next/link";
import { publicGallery } from "@/server/gallery";
import { GalleryGrid } from "@/components/gallery-grid";
import { GalleryIntro } from "@/components/catalog-skeletons";
export const dynamic = "force-dynamic";
export const generateMetadata = () =>
  publicPageMetadata("/art", {
    title: "Gallery",
    description:
      "Explore original artwork, series, and stories by Joel Hedstrom / Sadboi.",
  });
type Filters = { q?: string; series?: string; medium?: string };
export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const filters: Filters = Object.fromEntries(
    ["q", "series", "medium"].map((key) => [
      key,
      typeof raw[key] === "string" ? raw[key].slice(0, 160) : "",
    ]),
  );
  const works = await publicGallery();
  const series = [
    ...new Set(works.map((work) => work.series).filter(Boolean)),
  ].sort();
  const mediums = [...new Set(works.map((work) => work.medium))].sort();
  const filtered = works.filter(
    (work) =>
      (!filters.series || work.series === filters.series) &&
      (!filters.medium || work.medium === filters.medium) &&
      (!filters.q ||
        `${work.title} ${work.series} ${work.tags.join(" ")}`
          .toLowerCase()
          .includes(filters.q.toLowerCase())),
  );
  return (
    <main id="gallery-main" className="gallery-main gallery-main-fluid">
      <GalleryIntro />
      {!!works.length && (
        <form
          action="/art"
          className="gallery-filters"
          key={JSON.stringify(filters)}
        >
          <label>
            Find a piece
            <input
              name="q"
              type="search"
              defaultValue={filters.q}
              placeholder="Title, series, or theme"
              maxLength={160}
            />
          </label>
          <label>
            Series
            <select name="series" defaultValue={filters.series}>
              <option value="">All series</option>
              {series.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Medium
            <select name="medium" defaultValue={filters.medium}>
              <option value="">All mediums</option>
              {mediums.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="button primary">
            Apply filters
          </button>
          {(filters.q || filters.series || filters.medium) && (
            <Link href="/art" className="gallery-reset">
              Clear filters
            </Link>
          )}
        </form>
      )}
      <div className="gallery-results">
        <span>
          {filtered.length} {filtered.length === 1 ? "work" : "works"}
        </span>
        <span>THE GALLERY</span>
      </div>
      {filtered.length ? (
        <GalleryGrid works={filtered} fluid />
      ) : (
        <section className="gallery-empty">
          <h2>
            {works.length
              ? "No pieces match those filters."
              : "The collection is taking shape."}
          </h2>
          <p>
            {works.length
              ? "Try another title, series, or medium."
              : "Artwork and stories from the studio will appear here soon."}
          </p>
          <Link href={works.length ? "/art" : "/shop"}>
            {works.length ? "View all artwork →" : "Explore the shop →"}
          </Link>
        </section>
      )}
    </main>
  );
}
