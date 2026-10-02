const express = require("express");
const { listKinds, listConnections, requestConnection, acceptConnection, removeConnection, browse, copy } = require("./sharing.controller");

const router = express.Router();

router.get("/kinds", listKinds);
router.route("/connections").get(listConnections).post(requestConnection);
router.post("/connections/:id/accept", acceptConnection);
router.delete("/connections/:id", removeConnection);
// The connected admin's content of one kind, and copying chosen entries into this workspace.
router.get("/connections/:id/content/:kind", browse);
router.post("/connections/:id/copy", copy);

module.exports = router;
