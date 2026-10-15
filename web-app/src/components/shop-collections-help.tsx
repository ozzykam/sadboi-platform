import Link from "next/link";
export function ShopCollectionsHelp() {
  return (
    <section
      className="howto-section"
      id="collections"
      aria-labelledby="collections-help-title"
    >
      <h2 id="collections-help-title">Curate shop collections</h2>
      <p>
        Collections group products and artwork into a theme or release with a
        shareable page. Only super admins manage them. Publish the individual
        products through Inventory and the artwork through Public gallery first;
        adding an item to a collection never changes its own publication
        settings.
      </p>
      <ol>
        <li>
          Open <Link href="/admin/collections">Collections</Link> and choose{" "}
          <strong>New collection</strong>. Enter its public name and
          description. Collection display order controls the order of links in
          the shop; lower numbers appear first.
        </li>
        <li>
          Choose items under <strong>Products</strong> and{" "}
          <strong>Artwork</strong>. Use the up/down arrows to arrange each list.
          Remove only removes membership, keeping the original artwork, product
          and stock.
        </li>
        <li>
          Choose <strong>Save draft</strong>, then{" "}
          <strong>Publish collection</strong>. The shop gains a collection link;{" "}
          <strong>View public page</strong> opens its shareable address.
        </li>
        <li>
          To revise a live collection, choose <strong>Edit</strong>, make
          changes and <strong>Save draft</strong>. The old version stays public
          until <strong>Update published collection</strong>. Save or discard
          unsaved edits before other actions.
        </li>
        <li>
          <strong>Unpublish</strong> withdraws the page and keeps its draft.{" "}
          <strong>Archive collection</strong> also hides it from the active
          admin table. Turn on <strong>Include archived collections</strong>,
          choose Edit, then <strong>Restore draft</strong> to bring it back
          privately.
        </li>
      </ol>
      <p>
        <strong>Example:</strong> create “Night Creatures” with two prints and
        three published drawings. Move the featured print to the top, save and
        publish. Customers can browse the collection and add its products to the
        same cart as other shop items. No stock is reserved until the existing
        order workflow does so.
      </p>
      <p>
        <strong>Recovery:</strong> after an uncertain save, keep the dialog open
        and retry the same action without changing its contents. If another
        session changed the record, keep a copy of your edits, reload and
        reapply them. Unavailable items are marked in the editor; remove them or
        publish them separately before updating the collection.
      </p>
      <p>
        <strong>Visibility and limits:</strong> private or archived products and
        unpublished artwork disappear from live collections immediately on a
        fresh request. A collection with no remaining public items disappears
        until an included item is published again. Restoring an archived
        collection does not republish it. Each collection supports up to 100
        products and 100 artworks, arranged in separate sections. Names,
        descriptions, order and membership are published snapshots; item details
        and prices follow their own public records. SEO and sitemap follow the
        site settings. Collections do not change prices, discounts, rights,
        stock or checkout availability.
      </p>
    </section>
  );
}
