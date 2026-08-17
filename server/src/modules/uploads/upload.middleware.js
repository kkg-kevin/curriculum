const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const UPLOAD_DIR = path.join(__dirname, "../../../uploads");

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

const ALLOWED_DOCUMENT_MIME_TYPES = [
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  // Images
  "image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml",
  // Audio
  "audio/mpeg", "audio/wav", "audio/ogg",
  // Video
  "video/mp4", "video/webm", "video/quicktime",
  // Archives
  "application/zip", "application/x-zip-compressed",
  // Source code — browsers report wildly inconsistent MIME types for these (some send a
  // specific text/application type, many just fall back to generic ones), so the extension
  // whitelist below is the actual gate for code files; these are accepted here too since a
  // handful of browsers do report them accurately.
  "text/javascript", "application/javascript", "text/x-python", "application/x-python-code",
  "text/x-java-source", "text/x-c", "text/x-c++src", "text/html", "text/css",
  "application/json", "application/xml", "text/xml", "text/x-sh", "application/x-sh",
];

// codeUpload items (see AssessmentTaker.jsx/assessment.schema.js) cover both traditional source
// files and PictoBlox/Scratch project exports (this curriculum's block-coding tool — see e.g.
// the "Save the project... Upload the Assignment" PictoBlox task content). Browsers routinely
// report unrecognized extensions like .py/.sb3 as generic/blank MIME types, so those are let
// through by extension instead of relying on file.mimetype alone — this is the actual fix for
// "code uploads don't work": the MIME whitelist above never covered these regardless of what an
// assessment item's own (client-only, unenforced server-side) acceptedFileTypes claimed to allow.
const CODE_FILE_EXTENSIONS = [
  ".py", ".js", ".jsx", ".ts", ".tsx", ".java", ".c", ".h", ".cpp", ".hpp", ".cs", ".rb", ".go",
  ".php", ".html", ".htm", ".css", ".json", ".xml", ".sh", ".sql", ".swift", ".kt", ".r",
  ".ino", ".sb", ".sb2", ".sb3", ".pbx",
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    cb(null, `${crypto.randomUUID()}${path.extname(file.originalname)}`);
  },
});

function makeFileFilter(allowedMimeTypes, label, { allowedExtensions = [] } = {}) {
  return (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) return cb(null, true);
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) return cb(null, true);
    const err = new Error(`Only ${label} files are allowed`);
    err.statusCode = 400;
    return cb(err);
  };
}

const uploadMiddleware = multer({
  storage,
  fileFilter: makeFileFilter(ALLOWED_IMAGE_MIME_TYPES, "PNG, JPEG, GIF, and WEBP image"),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const documentUploadMiddleware = multer({
  storage,
  fileFilter: makeFileFilter(ALLOWED_DOCUMENT_MIME_TYPES, "document, image, audio, video, ZIP, or code", { allowedExtensions: CODE_FILE_EXTENSIONS }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

module.exports = { uploadMiddleware, documentUploadMiddleware };
