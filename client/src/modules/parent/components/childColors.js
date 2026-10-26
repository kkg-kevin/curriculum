// Each child keeps one colour across the parent portal — their menu badge, their card, their
// sessions on the family timetable — so a parent can tell whose is whose at a glance.
const COLORS = ["#2e7db5", "#e0841a", "#7c3aed", "#059669", "#db2777", "#0891b2"];

export const childColor = (index) => COLORS[index % COLORS.length];
