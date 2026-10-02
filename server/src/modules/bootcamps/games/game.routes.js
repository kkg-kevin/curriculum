const express = require("express");
const asyncHandler = require("express-async-handler");
const GameService = require("./game.service");
const { createGameSchema, updateGameSchema } = require("./game.validation");
const { parsePatch } = require("../../../shared/validators/common.validator");

// The games library, mounted at /api/bootcamps/games (see bootcamp.routes.js) — admin-only like
// the rest of the bootcamps module, and covered by the same Bootcamps staff permission.
const router = express.Router();

router.get("/", asyncHandler(async (req, res) => {
  const games = await GameService.list(req.ownerAdminId);
  res.json({ success: true, data: games, count: games.length });
}));

router.post("/", asyncHandler(async (req, res) => {
  const game = await GameService.create(req.ownerAdminId, createGameSchema.parse(req.body));
  res.status(201).json({ success: true, data: game });
}));

router.put("/:gameId", asyncHandler(async (req, res) => {
  const game = await GameService.update(req.ownerAdminId, req.params.gameId, parsePatch(updateGameSchema, req.body));
  res.json({ success: true, data: game });
}));

router.delete("/:gameId", asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await GameService.remove(req.ownerAdminId, req.params.gameId)) });
}));

module.exports = router;
