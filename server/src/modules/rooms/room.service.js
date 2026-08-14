const RoomModel = require("./room.model");
const TimetableModel = require("../timetable/timetable.model");

// Room name only needs to be unique within its own hub — two different hubs can both have a
// "Room 4". excludeId skips the record being updated so re-saving a room's own unchanged name
// doesn't collide with itself.
async function assertRoomNameAvailable(hubId, name, excludeId) {
  if (!name) return;
  const forHub = await RoomModel.findAll({ hubId });
  const others = forHub.filter((r) => r.id !== excludeId);
  if (others.some((r) => r.name.trim().toLowerCase() === name.trim().toLowerCase())) {
    const err = new Error("A room with this name already exists at this hub");
    err.statusCode = 409;
    throw err;
  }
}

const RoomService = {
  async createRoom(data) {
    await assertRoomNameAvailable(data.hubId, data.name, null);
    return RoomModel.create(data);
  },

  async getAllRooms(filters) {
    return RoomModel.findAll(filters);
  },

  async getRoomById(id) {
    const record = await RoomModel.findById(id);
    if (!record) {
      const err = new Error("Room not found");
      err.statusCode = 404;
      throw err;
    }
    return record;
  },

  async updateRoom(id, data) {
    if (data.name !== undefined) {
      const existing = await RoomModel.findById(id);
      if (existing) await assertRoomNameAvailable(existing.hubId, data.name, id);
    }
    const record = await RoomModel.update(id, data);
    if (!record) {
      const err = new Error("Room not found");
      err.statusCode = 404;
      throw err;
    }
    return record;
  },

  async deleteRoom(id) {
    const deleted = await RoomModel.delete(id);
    if (!deleted) {
      const err = new Error("Room not found");
      err.statusCode = 404;
      throw err;
    }
    // A room being retired doesn't invalidate the slots that referenced it — same "clear the
    // stale reference, keep the record" posture as teacher.service.js's clearMarkedBy/
    // clearCreatedBy.
    await TimetableModel.clearRoomId(id);
    return { message: "Room deleted successfully" };
  },
};

module.exports = RoomService;
