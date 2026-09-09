const express = require("express");
const { reassignOwner } = require("./reassign-owner.controller");

const router = express.Router();

router.post("/reassign-owner", reassignOwner);

module.exports = router;
