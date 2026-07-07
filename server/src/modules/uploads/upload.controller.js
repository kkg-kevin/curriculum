const asyncHandler = require("express-async-handler");

const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    const err = new Error("No image file provided");
    err.statusCode = 400;
    throw err;
  }
  res.status(201).json({ success: true, data: { url: `/uploads/${req.file.filename}` } });
});

const uploadDocument = asyncHandler(async (req, res) => {
  if (!req.file) {
    const err = new Error("No document file provided");
    err.statusCode = 400;
    throw err;
  }
  res.status(201).json({
    success: true,
    data: {
      url: `/uploads/${req.file.filename}`,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
    },
  });
});

module.exports = { uploadImage, uploadDocument };
