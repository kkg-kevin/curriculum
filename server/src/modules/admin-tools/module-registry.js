// Moved to ../access/access.registry.js when staff roles replaced per-collaborator module lists.
// Kept as a re-export for existing imports. MODULE_KEYS here is still the legacy list — the only
// keys the old `users.allowedModules` field may hold (billing / hub-visits are role-only).
const { LEGACY_MODULE_KEYS, PATH_PREFIX_TO_MODULE, resolveModuleForPath } = require("../access/access.registry");

module.exports = { MODULE_KEYS: LEGACY_MODULE_KEYS, PATH_PREFIX_TO_MODULE, resolveModuleForPath };
