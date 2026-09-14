const express = require("express");
const { inviteCollaborator, listCollaborators, revokeCollaborator } = require("./collaborator.controller");

const router = express.Router();

router.route("/collaborators").get(listCollaborators).post(inviteCollaborator);
router.delete("/collaborators/:id", revokeCollaborator);

module.exports = router;
