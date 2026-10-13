const express = require("express");
const { inviteCollaborator, listCollaborators, updateCollaborator, revokeCollaborator } = require("./collaborator.controller");

const { listUsers, setUserStatus } = require("./workspace-users.controller");

const router = express.Router();

router.route("/collaborators").get(listCollaborators).post(inviteCollaborator);
router.patch("/collaborators/:id", updateCollaborator);
router.delete("/collaborators/:id", revokeCollaborator);

// Every login in the workspace (Settings → People & sharing → Users), and switching one off/on.
router.get("/users", listUsers);
router.patch("/users/:id", setUserStatus);

module.exports = router;
