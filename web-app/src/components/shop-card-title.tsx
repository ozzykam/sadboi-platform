"use client";

import { useEffect, useRef } from "react";

export function ShopCardTitle({ title }: { title: string }) {
  const viewport = useRef<HTMLHeadingElement>(null);
  const text = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const heading = viewport.current;
    const content = text.current;
    if (!heading || !content) return;
    let active = true;
    const measure = () => {
      if (!active) return;
      const overflow = Math.max(0, content.scrollWidth - heading.clientWidth);
      heading.dataset.overflow = String(overflow > 1);
      // Clear the faded edge at the end so the final characters remain readable.
      const distance = overflow + 18;
      heading.style.setProperty("--title-travel", `-${distance}px`);
      heading.style.setProperty(
        "--title-duration",
        `${Math.max(3, distance / 32 + 1)}s`,
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(heading);
    observer.observe(content);
    measure();
    void document.fonts.ready.then(measure);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [title]);

  return (
    <h3 ref={viewport} className="shop-card-title" title={title}>
      <span ref={text}>{title}</span>
    </h3>
  );
}
