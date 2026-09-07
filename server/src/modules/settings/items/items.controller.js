const asyncHandler = require("express-async-handler");
const ItemsService = require("./items.service");
const { createItemSchema, updateItemSchema } = require("./items.validation");

exports.getItems = asyncHandler(async (req, res) => {
  const data = await ItemsService.getItems(req.ownerAdminId);
  res.json({ success: true, data });
});

exports.createItem = asyncHandler(async (req, res) => {
  const body = createItemSchema.parse(req.body);
  const data = await ItemsService.createItem({ ...body, ownerAdminId: req.ownerAdminId });
  res.status(201).json({ success: true, data });
});

exports.updateItem = asyncHandler(async (req, res) => {
  const body = updateItemSchema.parse(req.body);
  const data = await ItemsService.updateItem(req.params.itemId, body, req.ownerAdminId);
  res.json({ success: true, data });
});

exports.deleteItem = asyncHandler(async (req, res) => {
  await ItemsService.deleteItem(req.params.itemId, req.ownerAdminId);
  res.json({ success: true });
});
