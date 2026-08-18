const asyncHandler = require("express-async-handler");
const NotificationService = require("./notification.service");

const list = asyncHandler(async (req, res) => {
  const data = await NotificationService.listForMe(req.user.id);
  res.json({ success: true, data });
});

const markRead = asyncHandler(async (req, res) => {
  const notification = await NotificationService.markRead(req.params.id, req.user.id);
  if (!notification) {
    const err = new Error("Notification not found");
    err.statusCode = 404;
    throw err;
  }
  res.json({ success: true, data: notification });
});

const markAllRead = asyncHandler(async (req, res) => {
  await NotificationService.markAllRead(req.user.id);
  res.json({ success: true });
});

module.exports = { list, markRead, markAllRead };
