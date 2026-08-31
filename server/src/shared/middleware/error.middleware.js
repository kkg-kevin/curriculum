const logger = require("../utils/logger");
const { NODE_ENV } = require("../../config/env");

const errorHandler = (err, req, res, next) => {
  logger.error(err.message, err.stack);

  if (err.name === "ZodError") {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: err.issues || err.errors,
    });
  }

  const statusCode = err.statusCode || err.status || 500;
  // Below 500 the message is a deliberate app-thrown one (validation, 401/403/404, etc.) and
  // safe to show as-is. 500s are unexpected — in production, surface a generic message instead
  // of leaking internals (raw DB errors, stack-revealing text); the real message is still logged
  // above.
  const message =
    statusCode >= 500 && NODE_ENV === "production"
      ? "Internal server error"
      : err.message || "Internal server error";
  res.status(statusCode).json({
    success: false,
    message,
    // Machine-readable discriminators for the client — only present when an app-thrown error
    // set them (e.g. ACCOUNT_SUSPENDED from auth.service.js / scope.middleware.js). Absent for
    // every other error, so nothing existing changes shape.
    ...(err.code ? { code: err.code } : {}),
    ...(err.reason ? { reason: err.reason } : {}),
  });
};

const notFound = (req, res, next) => {
  const err = new Error(`Route not found: ${req.originalUrl}`);
  err.statusCode = 404;
  next(err);
};

module.exports = { errorHandler, notFound };
