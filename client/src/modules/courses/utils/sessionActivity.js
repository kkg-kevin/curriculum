export const VALID_ACTIVITY_MODES = ["individual", "group"];

export function normalizeActivityMode(mode) {
  return VALID_ACTIVITY_MODES.includes(mode) ? mode : "individual";
}

export function normalizeActivityItems(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      ...item,
      mode: normalizeActivityMode(item?.mode),
    }))
    .filter((item) => item.id);
}
