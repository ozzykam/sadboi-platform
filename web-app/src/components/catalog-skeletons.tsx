export function GalleryIntro() {
  return (
    <section className="gallery-intro">
      <p className="eyebrow">JOEL HEDSTROM / SADBOI</p>
      <h1>The body of work.</h1>
      <p>
        A collection of originals, ongoing obsessions, and the stories behind
        them.
      </p>
    </section>
  );
}

export function ShopIntro() {
  return (
    <section className="shop-hero shop-hero-compact">
      <p className="eyebrow">SADBOI / SHOP</p>
      <h1>
        Made in small
        <br />
        <em>editions.</em>
      </h1>
      <p>
        Objects, prints, and pieces from the studio. Browse the catalog by
        category.
      </p>
    </section>
  );
}

export function GallerySkeleton() {
  return (
    <main id="gallery-main" className="gallery-main">
      <GalleryIntro />
      <p role="status" className="sr-only">
        Loading artwork…
      </p>
      <div aria-hidden="true" className="catalog-loading gallery-loading">
        <div className="gallery-filters skeleton-filters">
          {[0, 1, 2].map((n) => (
            <div className="skeleton-surface skeleton-control" key={n} />
          ))}
        </div>
        <div className="gallery-results">
          <span className="skeleton-surface skeleton-line" />
          <span>THE GALLERY</span>
        </div>
        <div className="gallery-grid">
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <div className="gallery-card" key={n}>
              <div
                className="skeleton-surface skeleton-art skeleton-art-card"
                style={{ aspectRatio: ["4 / 5", "1 / 1", "3 / 4"][n % 3] }}
              >
                <span className="skeleton-object" />
              </div>
              <div className="gallery-card-caption">
                <span className="skeleton-surface skeleton-line skeleton-title" />
                <span className="skeleton-surface skeleton-line skeleton-year" />
              </div>
              <div className="skeleton-surface skeleton-line skeleton-subtitle" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

export function ShopSkeleton() {
  return (
    <main className="shop-shell">
      <ShopIntro />
      <p role="status" className="sr-only">
        Loading products…
      </p>
      <section
        className="shop-section catalog-loading shop-loading"
        aria-hidden="true"
      >
        <div className="shop-catalog-layout">
          <aside className="shop-sidebar">
            <p className="shop-sidebar-label">Browse</p>
            {[0, 1, 2, 3].map((n) => (
              <div
                className="skeleton-surface skeleton-line skeleton-category"
                key={n}
              />
            ))}
          </aside>
          <div className="shop-products">
            <div className="shop-products-heading">
              <div>
                <p className="eyebrow">Shop / All</p>
                <h2>All products</h2>
              </div>
              <span className="skeleton-surface skeleton-line" />
            </div>
            <div className="shop-product-grid">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
                <div className="shop-product" key={n}>
                  <div className="skeleton-surface skeleton-shop skeleton-shop-card">
                    <span className="skeleton-object" />
                  </div>
                  <div className="shop-product-meta">
                    <div className="skeleton-product-copy">
                      <div className="skeleton-surface skeleton-line skeleton-title" />
                      <div className="skeleton-surface skeleton-line skeleton-subtitle" />
                    </div>
                    <span className="skeleton-surface skeleton-line skeleton-price" />
                  </div>
                  <div className="skeleton-surface skeleton-control skeleton-product-button" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <footer className="shop-footer">
        <span>sadboi / studio</span>
        <span>Private studio editions · Made with intention</span>
      </footer>
    </main>
  );
}
