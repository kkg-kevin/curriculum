const express = require("express");
const { uploadMiddleware, documentUploadMiddleware } = require("./upload.middleware");
const { uploadImage, uploadDocument } = require("./upload.controller");

const router = express.Router();

router.post("/image", uploadMiddleware.single("image"), uploadImage);
router.post("/document", documentUploadMiddleware.single("document"), uploadDocument);

module.exports = router;
