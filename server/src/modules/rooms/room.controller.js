const asyncHandler = require("express-async-handler");
const RoomService = require("./room.service");
const { createRoomSchema, updateRoomSchema } = require("./room.validation");
const { assertOwn, isOwnHub } = require("../../shared/middleware/scope.middleware");

// Same fix as class.controller.js's pickPresent — updateRoomSchema is createRoomSchema.partial(),
// but zod still materializes a field's .default(...) when its key is simply absent from the
// request body, so a genuinely partial update must be filtered to only keys the caller actually sent.
function pickPresent(parsed, raw) {
  if (raw === null || typeof raw !== "object") return parsed;
  const result = {};
  for (const key of Object.keys(raw)) {
    if (parsed[key] === undefined) continue;
    result[key] = (typeof parsed[key] === "object" && parsed[key] !== null && !Array.isArray(parsed[key]))
      ? pickPresent(parsed[key], raw[key])
      : parsed[key];
  }
  return result;
}

const createRoom = asyncHandler(async (req, res) => {
  const data = createRoomSchema.parse(req.body);
  if (req.user.role === "school") {
    assertOwn(!!req.ownSchool);
    data.hubId = req.ownSchool.id;
  }
  const record = await RoomService.createRoom(data);
  res.status(201).json({ success: true, data: record });
});

const getAllRooms = asyncHandler(async (req, res) => {
  const { hubId, status } = req.query;
  const filters = { hubId, status };
  if (req.user.role === "school") {
    if (!req.ownSchool) return res.json({ success: true, data: [], count: 0 });
    filters.hubId = req.ownSchool.id;
  }
  const records = await RoomService.getAllRooms(filters);
  res.json({ success: true, data: records, count: records.length });
});

const getRoomById = asyncHandler(async (req, res) => {
  const record = await RoomService.getRoomById(req.params.id);
  if (req.user.role === "school") assertOwn(isOwnHub(req, record.hubId));
  res.json({ success: true, data: record });
});

const updateRoom = asyncHandler(async (req, res) => {
  const data = pickPresent(updateRoomSchema.parse(req.body), req.body);
  if (req.user.role === "school") {
    const existing = await RoomService.getRoomById(req.params.id);
    assertOwn(isOwnHub(req, existing.hubId));
    data.hubId = existing.hubId;
  }
  const record = await RoomService.updateRoom(req.params.id, data);
  res.json({ success: true, data: record });
});

// Which of a hub's rooms are already booked at an overlapping time on a given day — lets the
// slot picker gray out a busy room before the user tries to save, instead of only finding out
// from the 409 hasConflict already throws at save time. Read-only, same ownership posture as the
// other room reads (school is pinned to its own hub).
const getRoomAvailability = asyncHandler(async (req, res) => {
  const { hubId, dayOfWeek, startTime, endTime, excludeSlotId } = req.query;
  if (!hubId) return res.status(400).json({ success: false, message: "hubId is required" });
  let effectiveHubId = hubId;
  if (req.user.role === "school") {
    if (!req.ownSchool) return res.json({ success: true, data: [] });
    effectiveHubId = req.ownSchool.id;
  }
  const busyRoomIds = await RoomService.getBusyRoomIds(effectiveHubId, { dayOfWeek, startTime, endTime, excludeSlotId });
  res.json({ success: true, data: busyRoomIds });
});

const deleteRoom = asyncHandler(async (req, res) => {
  if (req.user.role === "school") {
    const existing = await RoomService.getRoomById(req.params.id);
    assertOwn(isOwnHub(req, existing.hubId));
  }
  const result = await RoomService.deleteRoom(req.params.id);
  res.json({ success: true, ...result });
});

module.exports = { createRoom, getAllRooms, getRoomById, updateRoom, deleteRoom, getRoomAvailability };
