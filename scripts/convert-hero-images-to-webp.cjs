// One-time conversion — run manually (`node scripts/convert-hero-images-to-webp.cjs`), not part
// of the build. Converts the largest eager-loaded homepage images to WebP alongside the
// originals. Source files are left in place (not deleted) so this is safely re-runnable; the
// source imports in routes/index.tsx were updated separately to point at the new .webp files.
//
// Second batch (2026-08-22, Phase 8c completion): the first run above covered 3 hero PNGs + 12
// category PNGs. These remaining 8 "cat*" category images and the food-packaging segment photo
// were still .jpg/.jpeg and still actively imported in index.tsx — genuinely missed by the first
// pass, not a duplicate of it (different filenames from the already-converted "seg*" category set).
const sharp = require("sharp");
const path = require("path");

const base = path.join(__dirname, "..", "src", "assets");
const files = [
  "packaging-cloud-hero-v3.png",
  "packaging-cloud-hero.png",
  "company-profile/eco-packaging-cluster.png",
  "categories/disposable tablesware.png",
  "categories/cutlery.png",
  "categories/drinks packaging.png",
  "categories/kitchen and table.png",
  "categories/wooden accessories.png",
  "categories/hygiene.png",
  "categories/bags and sacks.png",
  "categories/general supplies.png",
  "categories/stickers and labels.png",
  "categories/cosmetics.png",
  "categories/agriculture.png",
  "categories/Dairy.png",
  "categories/Pharmacy.png",
  "categories/cat-paper-bags.jpg",
  "categories/cat-boxes-cartons.jpg",
  "categories/cat-cups-sleeves.jpg",
  "categories/cat-mailers-pouches.jpg",
  "categories/cat-labels-stickers.jpg",
  "categories/cat-food-containers.jpg",
  "categories/cat-gift-event.jpg",
  "categories/cat-beauty-pharma.jpg",
  "categories/food packaging segment photo.jpeg",
];

const fs = require("fs");

(async () => {
  let totalBefore = 0;
  let totalAfter = 0;
  for (const f of files) {
    const src = path.join(base, f);
    const dest = src.replace(/\.(png|jpe?g)$/i, ".webp");
    if (fs.existsSync(dest)) {
      console.log(f.padEnd(45), "already converted, skipping");
      continue;
    }
    const before = fs.statSync(src).size;
    await sharp(src).webp({ quality: 82 }).toFile(dest);
    const after = fs.statSync(dest).size;
    totalBefore += before;
    totalAfter += after;
    console.log(
      f.padEnd(45),
      (before / 1024).toFixed(0).padStart(6) + " KB -> " + (after / 1024).toFixed(0).padStart(6) + " KB",
      "(" + (100 - (after / before) * 100).toFixed(0) + "% smaller)",
    );
  }
  console.log("\nTotal:", (totalBefore / 1024 / 1024).toFixed(2) + " MB -> " + (totalAfter / 1024 / 1024).toFixed(2) + " MB");
})();
