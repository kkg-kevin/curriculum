const asyncHandler     = require("express-async-handler");
const InventoryService = require("./inventory.service");
const {
  createInventoryItemSchema,
  updateInventoryItemSchema,
} = require("./inventory.validation");

exports.getInventoryItems = asyncHandler(async (req, res) => {
  const data = InventoryService.getInventoryItems();
  res.json({ success: true, data });
});

exports.createInventoryItem = asyncHandler(async (req, res) => {
  const body = createInventoryItemSchema.parse(req.body);
  const data = InventoryService.createInventoryItem(body);
  res.status(201).json({ success: true, data });
});

exports.updateInventoryItem = asyncHandler(async (req, res) => {
  const body = updateInventoryItemSchema.parse(req.body);
  const data = InventoryService.updateInventoryItem(req.params.itemId, body);
  res.json({ success: true, data });
});

exports.deleteInventoryItem = asyncHandler(async (req, res) => {
  InventoryService.deleteInventoryItem(req.params.itemId);
  res.json({ success: true });
});
