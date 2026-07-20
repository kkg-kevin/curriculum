const VALID_ACTIVITY_MODES = ["individual", "group"];

function normalizeActivityMode(mode) {
  return VALID_ACTIVITY_MODES.includes(mode) ? mode : "individual";
}

function normalizeActivityItems(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      ...item,
      mode: normalizeActivityMode(item?.mode),
    }))
    .filter((item) => item.id);
}

module.exports = {
  VALID_ACTIVITY_MODES,
  normalizeActivityMode,
  normalizeActivityItems,
};
