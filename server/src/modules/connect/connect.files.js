const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { UPLOAD_DIR } = require("../uploads/upload.middleware");
// The signing key, read when first needed (env.js insists on the database settings at load time).
const secret = () => require("../../config/env").JWT_SECRET;

// Pictures and project files on Digifunzi Connect. Children's photos are personal data, so — like
// expense receipts — they are NOT under the public /uploads address: they live in uploads/.connect/
// (app.js refuses that path outright) and are only ever sent through a signed, expiring link that
// the API hands to people who may see the post, message or project they are on (`signedUrl`).
//
// What is checked before a file is kept:
//   - its real type, from its first bytes — never the name or what the browser claims;
//   - pictures (JPEG, PNG, WEBP, GIF) have their hidden details taken out: where the photo was taken
//     (GPS), the camera, the date, comments — only a JPEG's turn-the-right-way-up flag is kept;
//   - project files: PDF, Scratch / PictoBlox projects (.sb3 .sb2 .pbx) and plain code / text
//     (.py .ino .txt .js .html .css .json .c .cpp .java .md) — text must be readable text, and is
//     always downloaded, never shown as a page;
//   - at most 10 MB.
const PRIVATE_DIR = path.join(UPLOAD_DIR, ".connect");
fs.mkdirSync(PRIVATE_DIR, { recursive: true });

const MAX_BYTES = 10 * 1024 * 1024;
const PROJECT_ARCHIVES = new Set([".sb3", ".sb2", ".pbx"]);
const TEXT_FILES = new Set([".py", ".ino", ".txt", ".js", ".html", ".css", ".json", ".c", ".cpp", ".h", ".java", ".md", ".csv"]);

const extOf = (name) => path.extname(String(name || "")).toLowerCase();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
});

function receiveFile(req, res, next) {
  upload.single("file")(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") err.message = "That file is bigger than 10 MB. Try a smaller picture or file.";
    err.statusCode = 400;
    return next(err);
  });
}

// ── What a file really is ────────────────────────────────────────────────────────────────────────
// { kind: "image"|"file", mimeType, ext } or null when it isn't something Connect takes.
function sniff(buffer, originalName) {
  const b = buffer;
  if (!b || b.length < 4) return null;
  const ext = extOf(originalName);
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { kind: "image", mimeType: "image/jpeg", ext: ".jpg" };
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { kind: "image", mimeType: "image/png", ext: ".png" };
  if (b.subarray(0, 6).toString("latin1") === "GIF87a" || b.subarray(0, 6).toString("latin1") === "GIF89a") return { kind: "image", mimeType: "image/gif", ext: ".gif" };
  if (b.length >= 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return { kind: "image", mimeType: "image/webp", ext: ".webp" };
  if (b.subarray(0, 5).toString("latin1") === "%PDF-") return { kind: "file", mimeType: "application/pdf", ext: ".pdf" };
  if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04 && PROJECT_ARCHIVES.has(ext)) {
    return { kind: "file", mimeType: "application/octet-stream", ext };
  }
  if (TEXT_FILES.has(ext) && looksLikeText(b)) return { kind: "file", mimeType: "text/plain", ext };
  return null;
}

function looksLikeText(buffer) {
  if (buffer.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}

// ── Taking the hidden details out of pictures ────────────────────────────────────────────────────
function stripMetadata(buffer, mimeType) {
  try {
    if (mimeType === "image/jpeg") return stripJpeg(buffer);
    if (mimeType === "image/png") return stripPng(buffer);
    if (mimeType === "image/webp") return stripWebp(buffer);
  } catch {
    // A picture we can't read safely isn't kept.
    return null;
  }
  return buffer;
}

// JPEG: drop every APPn segment except JFIF (APP0), the colour profile (APP2 "ICC_PROFILE") and
// Adobe (APP14), and every comment. The Exif segment (APP1, where GPS lives) is replaced by a tiny
// one holding only the orientation, so phone photos still show the right way up.
function stripJpeg(buf) {
  const out = [buf.subarray(0, 2)];
  let i = 2;
  let orientation = null;
  while (i < buf.length) {
    if (buf[i] !== 0xff) throw new Error("bad jpeg");
    const marker = buf[i + 1];
    if (marker === 0xff) { i += 1; continue; } // fill byte
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { out.push(buf.subarray(i, i + 2)); i += 2; continue; }
    if (marker === 0xd9) { out.push(buf.subarray(i, i + 2)); break; }
    const len = buf.readUInt16BE(i + 2);
    const segment = buf.subarray(i, i + 2 + len);
    if (marker === 0xda) {
      // Start of scan: the picture itself — everything from here is kept as it is.
      if (orientation) out.splice(out[1] && out[1][1] === 0xe0 ? 2 : 1, 0, exifWithOrientation(orientation));
      out.push(buf.subarray(i));
      return Buffer.concat(out);
    }
    const isApp = marker >= 0xe0 && marker <= 0xef;
    if (marker === 0xe1) {
      const o = readExifOrientation(segment.subarray(4));
      if (o) orientation = o;
    } else if (marker === 0xfe) {
      // comment — dropped
    } else if (!isApp || marker === 0xe0 || marker === 0xee || (marker === 0xe2 && segment.subarray(4, 15).toString("latin1") === "ICC_PROFILE")) {
      out.push(segment);
    }
    i += 2 + len;
  }
  if (orientation) out.splice(out[1] && out[1][1] === 0xe0 ? 2 : 1, 0, exifWithOrientation(orientation));
  return Buffer.concat(out);
}

function readExifOrientation(data) {
  if (data.subarray(0, 6).toString("latin1") !== "Exif\0\0") return null;
  const tiff = data.subarray(6);
  const little = tiff.subarray(0, 2).toString("latin1") === "II";
  const u16 = (o) => (little ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o));
  const u32 = (o) => (little ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o));
  const ifd = u32(4);
  const count = u16(ifd);
  for (let n = 0; n < count; n += 1) {
    const entry = ifd + 2 + n * 12;
    if (u16(entry) === 0x0112) {
      const value = u16(entry + 8);
      return value >= 1 && value <= 8 ? value : null;
    }
  }
  return null;
}

function exifWithOrientation(value) {
  // "Exif\0\0" + big-endian TIFF header + IFD0 with one entry (Orientation, SHORT, 1) + no next IFD.
  const body = Buffer.alloc(6 + 8 + 2 + 12 + 4);
  body.write("Exif\0\0", 0, "latin1");
  body.write("MM", 6, "latin1");
  body.writeUInt16BE(42, 8);
  body.writeUInt32BE(8, 10);
  body.writeUInt16BE(1, 14);
  body.writeUInt16BE(0x0112, 16);
  body.writeUInt16BE(3, 18);
  body.writeUInt32BE(1, 20);
  body.writeUInt16BE(value, 24);
  body.writeUInt32BE(0, 28);
  const head = Buffer.from([0xff, 0xe1, 0, 0]);
  head.writeUInt16BE(body.length + 2, 2);
  return Buffer.concat([head, body]);
}

// PNG: keep only the chunks that draw the picture.
const PNG_KEEP = new Set(["IHDR", "PLTE", "IDAT", "IEND", "tRNS", "gAMA", "cHRM", "sRGB", "iCCP", "sBIT", "pHYs", "bKGD", "acTL", "fcTL", "fdAT"]);
function stripPng(buf) {
  const out = [buf.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.subarray(i + 4, i + 8).toString("latin1");
    const end = i + 12 + len;
    if (end > buf.length) throw new Error("bad png");
    if (PNG_KEEP.has(type)) out.push(buf.subarray(i, end));
    i = end;
    if (type === "IEND") break;
  }
  return Buffer.concat(out);
}

// WEBP: drop the EXIF and XMP chunks and their flags.
function stripWebp(buf) {
  const chunks = [];
  let i = 12;
  while (i + 8 <= buf.length) {
    const type = buf.subarray(i, i + 4).toString("latin1");
    const len = buf.readUInt32LE(i + 4);
    const end = i + 8 + len + (len % 2);
    if (end > buf.length + 1) throw new Error("bad webp");
    if (type !== "EXIF" && type !== "XMP ") {
      const chunk = Buffer.from(buf.subarray(i, Math.min(end, buf.length)));
      if (type === "VP8X") chunk[8] &= ~0x0c;
      chunks.push(chunk);
    }
    i = end;
  }
  const body = Buffer.concat(chunks);
  const head = Buffer.alloc(12);
  head.write("RIFF", 0, "latin1");
  head.writeUInt32LE(body.length + 4, 4);
  head.write("WEBP", 8, "latin1");
  return Buffer.concat([head, body]);
}

// ── Keeping and sending ──────────────────────────────────────────────────────────────────────────
// Checks and stores an uploaded file. Returns { storedName, filename, mimeType, size, kind } or
// throws a 400 saying what's wrong.
async function store(file) {
  if (!file?.buffer?.length) throw Object.assign(new Error("Choose a file to upload."), { statusCode: 400 });
  const type = sniff(file.buffer, file.originalname);
  if (!type) {
    throw Object.assign(new Error("Connect takes pictures (JPG, PNG, WEBP, GIF), PDFs, Scratch or PictoBlox projects and code files (.py, .ino, .txt…)."), { statusCode: 400 });
  }
  let bytes = file.buffer;
  if (type.kind === "image") {
    bytes = stripMetadata(bytes, type.mimeType);
    if (!bytes) throw Object.assign(new Error("That picture couldn't be read. Try saving it again or taking a new one."), { statusCode: 400 });
  }
  const storedName = `${crypto.randomUUID()}${type.ext}`;
  await fs.promises.writeFile(path.join(PRIVATE_DIR, storedName), bytes);
  const base = path.basename(String(file.originalname || "file")).replace(/[^\w .()-]/g, "_").slice(0, 120) || "file";
  const filename = extOf(base) ? base : `${base}${type.ext}`;
  return { storedName, filename, mimeType: type.mimeType, size: bytes.length, kind: type.kind };
}

const pathOf = (storedName) => path.join(PRIVATE_DIR, path.basename(String(storedName || "")));

function removeStored(storedName) {
  fs.promises.unlink(pathOf(storedName)).catch(() => {});
}

// Signed links: valid until the end of the next 6-hour window, so the same picture keeps the same
// address for a while (the browser can cache it) and a copied link stops working soon after.
const WINDOW_MS = 6 * 60 * 60 * 1000;
const sign = (fileId, exp) => crypto.createHmac("sha256", secret()).update(`connect-file:${fileId}:${exp}`).digest("base64url").slice(0, 32);

function signedUrl(fileId, now = Date.now()) {
  const exp = Math.ceil(now / WINDOW_MS) * WINDOW_MS + WINDOW_MS;
  return `/api/connect-media/${fileId}/${exp}/${sign(fileId, exp)}`;
}

function verifySignature(fileId, exp, signature, now = Date.now()) {
  const e = Number(exp);
  if (!Number.isFinite(e) || e < now) return false;
  const expected = Buffer.from(sign(fileId, e));
  const given = Buffer.from(String(signature || ""));
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

function sendStored(res, file, exp) {
  const full = pathOf(file.storedName);
  if (!fs.existsSync(full)) return res.status(404).end();
  const inline = file.kind === "image" || file.mimeType === "application/pdf";
  const safeName = String(file.filename || "file").replace(/["\r\n\\]/g, "");
  res.setHeader("Content-Type", file.mimeType || "application/octet-stream");
  res.setHeader("Content-Disposition", `${inline ? "inline" : "attachment"}; filename="${safeName}"`);
  const seconds = Math.max(0, Math.floor((Number(exp) - Date.now()) / 1000));
  res.setHeader("Cache-Control", `private, max-age=${seconds}`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "sandbox");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  return fs.createReadStream(full).pipe(res);
}

module.exports = { PRIVATE_DIR, MAX_BYTES, receiveFile, sniff, stripMetadata, store, removeStored, signedUrl, verifySignature, sendStored };
