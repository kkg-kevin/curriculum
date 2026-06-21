const express = require("express");
const {
  createSupplementary,
  getAllSupplementary,
  getSupplementaryById,
  updateSupplementary,
  deleteSupplementary,
  updateGrades,
  updateMapping,
  updateAssignments,
} = require("./supplementary.controller");

const router = express.Router();

router.route("/").get(getAllSupplementary).post(createSupplementary);
router.route("/:id").get(getSupplementaryById).put(updateSupplementary).delete(deleteSupplementary);
router.put("/:id/grades",       updateGrades);
router.put("/:id/mapping",      updateMapping);
router.put("/:id/assignments",  updateAssignments);

module.exports = router;
