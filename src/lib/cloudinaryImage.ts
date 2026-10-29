// Product photos are stored at whatever resolution/format they were originally uploaded in — often a
// multi-hundred-KB PNG or JPEG straight off a phone camera — so the shop always asks for a copy sized
// to the width actually needed on screen. Two hosts serve those copies while photos move off Cloudinary:
//
// - Cloudinary: URL-based transformations (auto format — WebP/AVIF where the browser supports it — and
//   auto quality). The transform segment goes right after "/upload/", where every delivery URL expects it.
// - img.momentspackaging.com (our own image service behind Cloudflare): "/o/<key>" is the stored
//   original and "/w<width>/<key>" a WebP copy. Only fixed widths exist (so nobody can make the server
//   build thousands of odd sizes), so the width asked for is rounded up to the next one.
const CLOUDINARY_UPLOAD_MARKER = "/image/upload/";
const OWN_IMAGE_HOST = "https://img.momentspackaging.com/";
const OWN_IMAGE_WIDTHS = [
  64, 72, 96, 128, 160, 200, 240, 320, 360, 400, 480, 640, 720, 960, 1280, 1600,
];

/** Returns an address for the photo resized to `width` px (WebP where possible). Works for Cloudinary
 *  photos and our own img.momentspackaging.com ones; any other URL (or a missing/empty url) passes
 *  through unchanged. */
export function cloudinaryOptimized(url: string | null | undefined, width: number): string {
  if (!url) return "";
  if (url.startsWith(OWN_IMAGE_HOST + "o/")) {
    const preset =
      OWN_IMAGE_WIDTHS.find((w) => w >= width) ?? OWN_IMAGE_WIDTHS[OWN_IMAGE_WIDTHS.length - 1];
    return `${OWN_IMAGE_HOST}w${preset}/${url.slice(OWN_IMAGE_HOST.length + 2)}`;
  }
  const i = url.indexOf(CLOUDINARY_UPLOAD_MARKER);
  if (i === -1) return url;
  const insertAt = i + CLOUDINARY_UPLOAD_MARKER.length;
  return `${url.slice(0, insertAt)}f_auto,q_auto,w_${width}/${url.slice(insertAt)}`;
}
