const asyncHandler = require("express-async-handler");
const { z } = require("zod");
const NotificationService = require("./notification.service");

// `enabled` is the master switch for emailed notifications; `types` flips individual ones.
const emailPreferencesSchema = z.object({
  enabled: z.boolean().optional(),
  types: z.record(z.string(), z.boolean()).optional(),
});

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

const getEmailPreferences = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await NotificationService.getEmailPreferences(req.user.id) });
});

const updateEmailPreferences = asyncHandler(async (req, res) => {
  const data = emailPreferencesSchema.parse(req.body);
  res.json({ success: true, data: await NotificationService.updateEmailPreferences(req.user.id, data) });
});

module.exports = { list, markRead, markAllRead, getEmailPreferences, updateEmailPreferences };
