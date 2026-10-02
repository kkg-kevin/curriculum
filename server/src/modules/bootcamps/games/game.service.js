const GameModel = require("./game.model");
const BootcampModel = require("../bootcamp.model");

// The games library (Events → Games): the games and play activities an admin's bootcamps can
// include. A game is described once here and picked into any number of bootcamps
// (bootcamps.gameIds), which is what the public bootcamp page shows as its "more than lessons"
// section — see public-bootcamp.service.js.

function fail(message, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode });
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

const shape = (game, usedIn = 0) => ({ ...game, skills: asArray(game.skills), usedIn });

async function assertNameFree(ownerAdminId, name, exceptId = null) {
  const clash = await GameModel.findByName(ownerAdminId, name);
  if (clash && clash.id !== exceptId) fail("You already have a game with this name", 409);
}

async function ownGameOrThrow(id, ownerAdminId) {
  const game = await GameModel.findById(id);
  if (!game || game.ownerAdminId !== ownerAdminId) fail("Game not found", 404);
  return game;
}

const GameService = {
  // Every game in the library, with how many of the admin's bootcamps include it.
  async list(ownerAdminId) {
    const [games, bootcamps] = await Promise.all([GameModel.findAll(ownerAdminId), BootcampModel.findAll({ ownerAdminId })]);
    const usage = new Map();
    for (const bootcamp of bootcamps) {
      for (const id of asArray(bootcamp.gameIds)) usage.set(id, (usage.get(id) || 0) + 1);
    }
    return games.map((game) => shape(game, usage.get(game.id) || 0));
  },

  async create(ownerAdminId, data) {
    await assertNameFree(ownerAdminId, data.name);
    return shape(await GameModel.create({ ...data, ownerAdminId }));
  },

  async update(ownerAdminId, id, data) {
    await ownGameOrThrow(id, ownerAdminId);
    if (data.name !== undefined) await assertNameFree(ownerAdminId, data.name, id);
    return shape(await GameModel.update(id, data));
  },

  // Removing a game from the library also takes it out of every bootcamp that included it — a
  // bootcamp must never point at a game that no longer exists.
  async remove(ownerAdminId, id) {
    await ownGameOrThrow(id, ownerAdminId);
    const bootcamps = await BootcampModel.findAll({ ownerAdminId });
    for (const bootcamp of bootcamps) {
      const gameIds = asArray(bootcamp.gameIds);
      if (gameIds.includes(id)) await BootcampModel.update(bootcamp.id, { gameIds: gameIds.filter((g) => g !== id) });
    }
    await GameModel.delete(id);
    return { message: "Game deleted" };
  },

  // A bootcamp may only include games from its own admin's library.
  async assertOwnGames(gameIds, ownerAdminId) {
    const ids = asArray(gameIds);
    if (!ids.length) return;
    const games = await GameModel.findByIds(ids);
    const own = new Set(games.filter((game) => game.ownerAdminId === ownerAdminId).map((game) => game.id));
    if (ids.some((id) => !own.has(id))) fail("One of the chosen games isn't in your games library");
  },

  // A bootcamp's games in the order the bootcamp lists them. Ids that no longer resolve are skipped.
  async resolveForBootcamp(gameIds) {
    const ids = asArray(gameIds);
    const byId = new Map((await GameModel.findByIds(ids)).map((game) => [game.id, shape(game)]));
    return ids.map((id) => byId.get(id)).filter(Boolean);
  },
};

module.exports = GameService;
