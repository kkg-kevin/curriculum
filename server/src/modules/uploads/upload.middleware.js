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
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    cb(null, `${crypto.randomUUID()}${path.extname(file.originalname)}`);
  },
});

function makeFileFilter(allowedMimeTypes, label) {
  return (req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      const err = new Error(`Only ${label} files are allowed`);
      err.statusCode = 400;
      return cb(err);
    }
    cb(null, true);
  };
}

const uploadMiddleware = multer({
  storage,
  fileFilter: makeFileFilter(ALLOWED_IMAGE_MIME_TYPES, "PNG, JPEG, GIF, and WEBP image"),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const documentUploadMiddleware = multer({
  storage,
  fileFilter: makeFileFilter(ALLOWED_DOCUMENT_MIME_TYPES, "document, image, audio, video, or ZIP"),
  limits: { fileSize: 50 * 1024 * 1024 },
});

module.exports = { uploadMiddleware, documentUploadMiddleware };
