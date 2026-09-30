import { useState } from "react";
import { FiBox, FiTag } from "react-icons/fi";
import { useItems } from "../hooks/useItems";
import { ITEM_KINDS } from "../constants";
import GoodsPanel from "./GoodsPanel";
import ServicesPanel from "./ServicesPanel";

const KIND_ICONS = { goods: FiBox, service: FiTag };

// Settings → Items: one catalog, split into Goods (physical — the former Inventory tab: course and
// project materials, the website Store) and Services (non-physical charges — the former billing
// Items tab). Both can be picked on the invoice form.
export default function ItemsPanel({ initialKind = "goods" }) {
  const [kind, setKind] = useState(ITEM_KINDS.some((k) => k.key === initialKind) ? initialKind : "goods");
  const { data: all = [] } = useItems();
  const countOf = (key) => all.filter((i) => i.kind === key).length;
  const active = ITEM_KINDS.find((k) => k.key === kind);

  return (
    <div>
      <div role="tablist" aria-label="Item type" style={{ display: "inline-flex", padding: "4px", gap: "4px", borderRadius: "12px", backgroundColor: "#F3F4F6", marginBottom: "8px" }}>
        {ITEM_KINDS.map(({ key, label }) => {
          const on = key === kind;
          const Icon = KIND_ICONS[key];
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setKind(key)}
              style={{
                display: "inline-flex", alignItems: "center", gap: "7px", padding: "8px 16px", borderRadius: "9px",
                border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 700,
                backgroundColor: on ? "#fff" : "transparent", color: on ? "#25476a" : "#6B7280",
                boxShadow: on ? "0 1px 3px rgba(15,38,69,0.12)" : "none", transition: "background-color 0.15s, color 0.15s",
              }}
            >
              <Icon size={14} strokeWidth={2.2} />
              {label}
              <span style={{ fontSize: "11px", fontWeight: 800, padding: "1px 7px", borderRadius: "20px", backgroundColor: on ? "#EAF4FB" : "#E5E7EB", color: on ? "#25476a" : "#6B7280" }}>
                {countOf(key)}
              </span>
            </button>
          );
        })}
      </div>
      <p style={{ margin: "0 0 20px", fontSize: "12px", color: "#9CA3AF" }}>{active.blurb}</p>

      {kind === "goods" ? <GoodsPanel /> : <ServicesPanel />}
    </div>
  );
}
