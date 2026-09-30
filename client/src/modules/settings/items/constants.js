import { FiCpu, FiZap, FiBox, FiDroplet, FiTool, FiPackage } from "react-icons/fi";

// Settings → Items: one catalog, every item either Goods or a Service. Mirrors
// server/src/modules/settings/items/items.validation.js — single source of truth.
export const ITEM_KINDS = [
  { key: "goods", label: "Goods", blurb: "Physical things — course and project materials, and what you sell in the website Store" },
  { key: "service", label: "Services", blurb: "Non-physical charges — tuition, subscriptions, sessions — picked when creating an invoice" },
];

// Goods only: the materials category.
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

// Both kinds: which invoice type an item is offered for on the invoice form ("Any" when unset).
export const INVOICE_TYPE_LABELS = {
  hub_subscription: "Hub subscription",
  learner_term: "Learner per term",
  course_module: "Course / module",
  bootcamp: "One-time bootcamp",
};

export function formatMoney(amount) {
  return amount === null || amount === undefined || amount === ""
    ? null
    : `KES ${Number(amount).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// What an item prefills on an invoice line: its invoice price, or — for Goods with no invoice
// price but a KES website price — that website price. null → the amount is typed by hand.
export function invoicePriceOf(item) {
  if (item.defaultPrice !== null && item.defaultPrice !== undefined) return Number(item.defaultPrice);
  if (item.kind === "goods" && item.priceAmount != null && (item.priceCurrency || "KES") === "KES") return Number(item.priceAmount);
  return null;
}
