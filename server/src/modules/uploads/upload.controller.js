const asyncHandler = require("express-async-handler");
const UploadService = require("./upload.service");

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

// A large file sent in pieces — see upload.service.js.
const startUpload = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await UploadService.start(req.user.id, req.body || {}) });
});

const getUpload = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await UploadService.status(req.user.id, req.params.id) });
});

// A refusal that carries where the upload really stands (a piece out of place, or completing too
// early) answers with it, so the client can carry on from the right byte.
const withProgress = (handler) => asyncHandler(async (req, res) => {
  try {
    await handler(req, res);
  } catch (err) {
    if (!err.upload) throw err;
    res.status(err.statusCode).json({ success: false, message: err.message, data: err.upload });
  }
});

const appendChunk = withProgress(async (req, res) => {
  try {
    const data = await UploadService.append(req.user.id, req.params.id, Number(req.query.offset), req);
    res.json({ success: true, data });
  } catch (err) {
    // Refused before (or partway through) reading the piece: let the rest of it drain, so the
    // browser gets the answer instead of a broken connection.
    req.resume();
    throw err;
  }
});

const completeUpload = withProgress(async (req, res) => {
  res.status(201).json({ success: true, data: await UploadService.complete(req.user.id, req.params.id) });
});

const cancelUpload = asyncHandler(async (req, res) => {
  await UploadService.cancel(req.user.id, req.params.id);
  res.json({ success: true });
});

module.exports = { uploadImage, uploadDocument, startUpload, getUpload, appendChunk, completeUpload, cancelUpload };
