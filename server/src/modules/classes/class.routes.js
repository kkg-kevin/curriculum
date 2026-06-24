const express = require("express");
const { createClass, getAllClasses, getClassById, updateClass, deleteClass, bulkCreateClasses } = require("./class.controller");

const router = express.Router();

router.route("/bulk").post(bulkCreateClasses);
router.route("/").get(getAllClasses).post(createClass);
router.route("/:id").get(getClassById).put(updateClass).delete(deleteClass);

module.exports = router;
