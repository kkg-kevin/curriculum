const express = require("express");
const {
  getInventoryItems,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
} = require("./inventory.controller");

const router = express.Router();

router.route("/").get(getInventoryItems).post(createInventoryItem);
router.route("/:itemId").put(updateInventoryItem).delete(deleteInventoryItem);

module.exports = router;
