const express = require("express");
const { makeItemsController } = require("./items.controller");

function makeItemsRouter(options) {
  const { getItems, createItem, updateItem, deleteItem } = makeItemsController(options);
  const router = express.Router();
  router.route("/").get(getItems).post(createItem);
  router.route("/:itemId").put(updateItem).delete(deleteItem);
  return router;
}

// Settings → Items (Goods + Services).
const itemsRouter = makeItemsRouter();
// The Goods half under its old name — Courses' and Projects' material pickers, and anything else
// that still calls /api/inventory, keep working unchanged.
const goodsRouter = makeItemsRouter({ onlyKind: "goods" });

module.exports = { itemsRouter, goodsRouter };
