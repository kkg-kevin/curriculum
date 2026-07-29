const express = require("express");
const {
  getSystemLevels,
  createSystemLevel,
  updateSystemLevel,
  deleteSystemLevel,
  reorderSystemLevels,
} = require("./system-level.controller");

const router = express.Router();

router.route("/").get(getSystemLevels).post(createSystemLevel);
router.route("/reorder").post(reorderSystemLevels);
router.route("/:lId").put(updateSystemLevel).delete(deleteSystemLevel);

module.exports = router;
