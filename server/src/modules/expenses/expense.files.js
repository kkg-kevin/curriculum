const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { UPLOAD_DIR } = require("../uploads/upload.middleware");

// Proof for expenses — receipt photos, M-Pesa screenshots, PDFs. These are financial and personal,
// so unlike every other upload they are NOT under the public /uploads address: they live in
// uploads/.expenses/ (a dot-folder express.static never serves, and app.js refuses the path
// outright too) and are only ever sent by GET /api/expenses/files/:id to the claimant and the
// people who review or pay the claim. Keeping them inside uploads/ means they travel with it
// wherever the uploads folder is kept between releases.
const PRIVATE_DIR = path.join(UPLOAD_DIR, ".expenses");
fs.mkdirSync(PRIVATE_DIR, { recursive: true });

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/heic": ".heic",
  "image/heif": ".heif",
  "application/pdf": ".pdf",
};
const EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif", ".pdf"]);

const extOf = (name) => path.extname(String(name || "")).toLowerCase();

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, PRIVATE_DIR),
    filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${ALLOWED[file.mimetype] || (EXTENSIONS.has(extOf(file.originalname)) ? extOf(file.originalname) : "")}`),
  }),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED[file.mimetype] || EXTENSIONS.has(extOf(file.originalname))) return cb(null, true);
    const err = new Error("Proof must be a photo (JPG, PNG, WEBP, HEIC) or a PDF");
    err.statusCode = 400;
    return cb(err);
  },
});

// multer's own errors (too big) as a clear 400.
function receiveFile(req, res, next) {
  upload.single("file")(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      err.statusCode = 400;
      err.message = "That file is larger than 10 MB. Take a smaller photo, or send a PDF.";
    }
    err.statusCode = err.statusCode || 400;
    return next(err);
  });
}

function sha256Of(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    fs.createReadStream(filePath).on("data", (d) => hash.update(d)).on("end", () => resolve(hash.digest("hex"))).on("error", reject);
  });
}

// The stored file's path — only ever a bare name inside PRIVATE_DIR.
function pathOf(storedName) {
  const name = path.basename(String(storedName || ""));
  return path.join(PRIVATE_DIR, name);
}

function removeStored(storedName) {
  fs.promises.unlink(pathOf(storedName)).catch(() => {});
}

// Sends a proof file. Images and PDFs show in the browser; anything else downloads.
function sendStored(res, file, { download = false } = {}) {
  const full = pathOf(file.storedName);
  if (!fs.existsSync(full)) {
    const err = new Error("This file is no longer on the server");
    err.statusCode = 404;
    throw err;
  }
  const inline = !download && /^(image\/(jpeg|png|webp|gif)|application\/pdf)$/.test(file.mimeType);
  const safeName = String(file.filename || "proof").replace(/["\r\n\\]/g, "");
  res.setHeader("Content-Type", file.mimeType || "application/octet-stream");
  res.setHeader("Content-Disposition", `${inline ? "inline" : "attachment"}; filename="${safeName}"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "sandbox");
  fs.createReadStream(full).pipe(res);
}

module.exports = { PRIVATE_DIR, MAX_BYTES, receiveFile, sha256Of, pathOf, removeStored, sendStored };
