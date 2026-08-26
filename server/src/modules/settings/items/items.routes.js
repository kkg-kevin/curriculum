const express = require("express");
const { getItems, createItem, updateItem, deleteItem } = require("./items.controller");

const router = express.Router();

router.route("/").get(getItems).post(createItem);
router.route("/:itemId").put(updateItem).delete(deleteItem);

module.exports = router;
