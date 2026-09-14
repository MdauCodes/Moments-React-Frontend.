// Cloudinary serves product photos at whatever resolution/format they were originally uploaded
// in — often a multi-hundred-KB PNG or JPEG straight off a phone camera. Its URL-based
// transformations let us request a web-appropriate derivative (auto format — WebP/AVIF where the
// browser supports it — and auto quality, resized to the width actually needed on screen) without
// touching the original upload or needing a backend change. The transform segment goes right
// after "/upload/", which is where every Cloudinary delivery URL expects it.
const CLOUDINARY_UPLOAD_MARKER = "/image/upload/";

/** Returns a Cloudinary delivery URL asking for an auto-format, auto-quality image resized to
 *  `width` px. Non-Cloudinary URLs (or a missing/empty url) pass through unchanged. */
export function cloudinaryOptimized(url: string | null | undefined, width: number): string {
  if (!url) return "";
  const i = url.indexOf(CLOUDINARY_UPLOAD_MARKER);
  if (i === -1) return url;
  const insertAt = i + CLOUDINARY_UPLOAD_MARKER.length;
  return `${url.slice(0, insertAt)}f_auto,q_auto,w_${width}/${url.slice(insertAt)}`;
}
