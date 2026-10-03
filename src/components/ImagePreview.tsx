import { useEffect, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Download, X, ZoomIn } from 'lucide-react';

export type ImagePreviewItem = { src: string; alt?: string };

export function ImagePreviewLightbox({
  items,
  index,
  onClose,
  onIndexChange,
  onDownload,
}: {
  items: ImagePreviewItem[];
  index: number;
  onClose: () => void;
  onIndexChange?: (i: number) => void;
  onDownload?: (item: ImagePreviewItem) => void;
}) {
  const current = items[index];
  const hasMany = items.length > 1;

  const go = (delta: number) => {
    if (!hasMany) return;
    const next = (index + delta + items.length) % items.length;
    onIndexChange?.(next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (!hasMany) return;
      if (e.key === 'ArrowLeft') onIndexChange?.((index - 1 + items.length) % items.length);
      if (e.key === 'ArrowRight') onIndexChange?.((index + 1) % items.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hasMany, index, items.length, onClose, onIndexChange]);

  if (!current?.src) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex max-h-[92vh] max-w-[92vw] flex-col items-center"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Image preview"
      >
        <button
          type="button"
          className="absolute -right-2 -top-2 z-10 rounded-full bg-white p-1.5 text-erp-text-primary shadow"
          onClick={onClose}
          aria-label="Close preview"
        >
          <X size={16} />
        </button>
        {onDownload && (
          <button
            type="button"
            className="absolute -right-2 top-8 z-10 rounded-full bg-white p-1.5 text-erp-text-primary shadow"
            onClick={() => onDownload(current)}
            aria-label="Download invoice"
            title="Download invoice"
          >
            <Download size={16} />
          </button>
        )}
        {hasMany && (
          <button
            type="button"
            className="absolute left-0 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-erp-text-primary shadow"
            onClick={() => go(-1)}
            aria-label="Previous image"
          >
            <ChevronLeft size={18} />
          </button>
        )}
        <img
          src={current.src}
          alt={current.alt || 'Preview'}
          className="max-h-[85vh] max-w-[90vw] rounded-md object-contain shadow-2xl"
        />
        {hasMany && (
          <button
            type="button"
            className="absolute right-0 top-1/2 z-10 translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-erp-text-primary shadow"
            onClick={() => go(1)}
            aria-label="Next image"
          >
            <ChevronRight size={18} />
          </button>
        )}
        <p className="mt-2 max-w-[90vw] truncate text-center text-[12px] text-white/90">
          {current.alt || 'Preview'}
          {hasMany ? `  ·  ${index + 1} / ${items.length}` : ''}
        </p>
      </div>
    </div>,
    document.body,
  );
}

export function PreviewableImage({
  src,
  alt,
  className = '',
  gallery,
  galleryIndex = 0,
  onDownload,
}: {
  src: string;
  alt?: string;
  className?: string;
  gallery?: ImagePreviewItem[];
  galleryIndex?: number;
  onDownload?: (item: ImagePreviewItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(galleryIndex);
  const items = gallery?.length ? gallery : [{ src, alt }];

  const openAt = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIndex(galleryIndex);
    setOpen(true);
  };

  if (!src) return null;

  return (
    <>
      <button
        type="button"
        className="group relative block overflow-hidden rounded ring-1 ring-[var(--erp-border)]"
        onClick={openAt}
        title="Preview"
        aria-label={alt ? `Preview ${alt}` : 'Preview image'}
      >
        <img src={src} alt={alt || ''} className={className} />
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100">
          <ZoomIn size={14} />
        </span>
      </button>
      {open && (
        <ImagePreviewLightbox
          items={items}
          index={index}
          onClose={() => setOpen(false)}
          onIndexChange={setIndex}
          onDownload={onDownload}
        />
      )}
    </>
  );
}
