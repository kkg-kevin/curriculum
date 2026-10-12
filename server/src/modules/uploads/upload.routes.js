const express = require("express");
const { uploadMiddleware, documentUploadMiddleware } = require("./upload.middleware");
const { uploadImage, uploadDocument, startUpload, getUpload, appendChunk, completeUpload, cancelUpload } = require("./upload.controller");

const router = express.Router();

router.post("/image", uploadMiddleware.single("image"), uploadImage);
router.post("/document", documentUploadMiddleware.single("document"), uploadDocument);

// The same document upload for a large file, sent in pieces (upload.service.js): start, send each
// piece, complete. GET says how much has arrived, for carrying on after a dropped connection.
router.post("/sessions", startUpload);
router.get("/sessions/:id", getUpload);
router.post("/sessions/:id/chunks", appendChunk);
router.post("/sessions/:id/complete", completeUpload);
router.delete("/sessions/:id", cancelUpload);

module.exports = router;
