const asyncHandler     = require("express-async-handler");
const InventoryService = require("./inventory.service");
const {
  createInventoryItemSchema,
  updateInventoryItemSchema,
} = require("./inventory.validation");

exports.getInventoryItems = asyncHandler(async (req, res) => {
  const data = await InventoryService.getInventoryItems(req.ownerAdminId);
  res.json({ success: true, data });
});

exports.createInventoryItem = asyncHandler(async (req, res) => {
  const body = createInventoryItemSchema.parse(req.body);
  const data = await InventoryService.createInventoryItem({ ...body, ownerAdminId: req.ownerAdminId });
  res.status(201).json({ success: true, data });
});

exports.updateInventoryItem = asyncHandler(async (req, res) => {
  const body = updateInventoryItemSchema.parse(req.body);
  const data = await InventoryService.updateInventoryItem(req.params.itemId, body, req.ownerAdminId);
  res.json({ success: true, data });
});

exports.deleteInventoryItem = asyncHandler(async (req, res) => {
  await InventoryService.deleteInventoryItem(req.params.itemId, req.ownerAdminId);
  res.json({ success: true });
});
