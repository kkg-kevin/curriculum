import { FiCpu, FiZap, FiBox, FiDroplet, FiTool, FiPackage } from "react-icons/fi";

// Mirrors server/src/modules/settings/inventory/inventory.validation.js — single source of truth.
export const INVENTORY_CATEGORIES = ["Robots", "Electronics", "Components", "Consumables", "Tools", "Other"];

export const INVENTORY_CATEGORY_COLORS = {
  Robots: "#7C3AED", Electronics: "#38aae1", Components: "#059669",
  Consumables: "#D97706", Tools: "#DC2626", Other: "#6B7280",
};

// Most catalog items are robotics kit parts (boards like Quarky, sensors, motors) rather
// than generic office supplies, so icons lean toward that rather than a plain box for everything.
export const INVENTORY_CATEGORY_ICONS = {
  Robots: FiCpu, Electronics: FiZap, Components: FiBox,
  Consumables: FiDroplet, Tools: FiTool, Other: FiPackage,
};
