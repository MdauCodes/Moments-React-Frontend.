import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";

interface ProductGalleryProps {
  images: string[];
  productName: string;
  /** Overlay badges (New/Discount/Hot) positioned top-left of the main image. */
  badges?: ReactNode;
}

/**
 * Product image gallery — main image + a thumbnail rail (vertical beside the image on desktop,
 * horizontal below it on mobile) and a full lightbox on click (prev/next, keyboard arrows,
 * Escape to close). Replaces the old "thumbnails always below, no zoom" layout.
 */
export function ProductGallery({ images, productName, badges }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Reset to the first image when the product itself changes (navigating between products).
  useEffect(() => {
    setActiveIndex(0);
  }, [images.join("|")]);

  useEffect(() => {
    if (!lightboxOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowLeft") setActiveIndex((i) => (i - 1 + images.length) % images.length);
      if (e.key === "ArrowRight") setActiveIndex((i) => (i + 1) % images.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen, images.length]);

  // Lock background scroll while the lightbox is open.
  useEffect(() => {
    if (!lightboxOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prevOverflow; };
  }, [lightboxOpen]);

  if (images.length === 0) {
    return (
      <div className="flex aspect-square max-h-[380px] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-secondary px-4 sm:max-h-[440px]">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-muted-foreground/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        <span className="text-center text-xs text-muted-foreground/40">{productName}</span>
      </div>
    );
  }

  const activeImage = images[activeIndex];

  return (
    <div className="flex flex-col gap-3 lg:flex-row-reverse">
      <div className="relative flex-1">
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="group relative block aspect-square max-h-[380px] w-full overflow-hidden rounded-2xl border border-border bg-secondary sm:max-h-[440px]"
        >
          <img src={activeImage} alt={productName} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
          <span className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
            <ZoomIn size={13} /> Click to zoom
          </span>
          {images.length > 1 && (
            <span className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white">
              {activeIndex + 1} / {images.length}
            </span>
          )}
        </button>
        {badges && <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5">{badges}</div>}
      </div>

      {images.length > 1 && (
        <div className="scrollbar-hide flex gap-2 overflow-x-auto lg:w-20 lg:flex-shrink-0 lg:flex-col lg:overflow-x-visible lg:overflow-y-auto">
          {images.map((img, i) => (
            <button
              key={img + i}
              type="button"
              onClick={() => setActiveIndex(i)}
              className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-colors lg:h-20 lg:w-20 ${
                i === activeIndex ? "border-primary" : "border-transparent hover:border-border"
              }`}
            >
              <img src={img} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {lightboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${productName} — full-size image`}
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            aria-label="Close"
          >
            <X size={20} />
          </button>
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setActiveIndex((i) => (i - 1 + images.length) % images.length); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
                aria-label="Previous image"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setActiveIndex((i) => (i + 1) % images.length); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
                aria-label="Next image"
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}
          <img
            src={activeImage}
            alt={productName}
            className="max-h-[88vh] max-w-[92vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {images.length > 1 && (
            <span className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white">
              {activeIndex + 1} / {images.length}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
