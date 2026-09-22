const express = require("express");
const { inviteCollaborator, listCollaborators, updateCollaborator, revokeCollaborator } = require("./collaborator.controller");

const router = express.Router();

router.route("/collaborators").get(listCollaborators).post(inviteCollaborator);
router.patch("/collaborators/:id", updateCollaborator);
router.delete("/collaborators/:id", revokeCollaborator);

module.exports = router;
