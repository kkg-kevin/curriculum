const express = require("express");
const {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} = require("./template.controller");

const router = express.Router();

router.route("/").get(getTemplates).post(createTemplate);
router.route("/:id").put(updateTemplate).delete(deleteTemplate);

module.exports = router;
