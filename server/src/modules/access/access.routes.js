const express = require("express");
const { listModules, listRoles, createRole, updateRole, deleteRole } = require("./access.controller");

const router = express.Router();

router.get("/modules", listModules);
router.route("/roles").get(listRoles).post(createRole);
router.route("/roles/:id").put(updateRole).delete(deleteRole);

module.exports = router;
