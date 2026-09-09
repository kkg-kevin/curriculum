const asyncHandler = require("express-async-handler");
const PublicStoreService = require("./public-store.service");

// digifunzi-landing's Store section (/store, /store/:slug). Bare array/object responses (no
// { success, data } wrapper) — same convention as public-site.controller.js and
// public-project.controller.js. 404s an unknown id/slug OR an item that isn't for sale /
// belongs to another admin (undifferentiated, so a probing client can't tell which).

const getPublicStoreItems = asyncHandler(async (req, res) => {
  const records = await PublicStoreService.listItems();
  res.json(records);
});

const getPublicStoreItem = asyncHandler(async (req, res) => {
  const record = await PublicStoreService.getItem(req.params.idOrSlug);
  if (!record) return res.status(404).json({ message: "Store item not found" });
  res.json(record);
});

module.exports = { getPublicStoreItems, getPublicStoreItem };
