import { useState } from "react";
import { useCreateInventoryItem } from "../../settings/inventory/hooks/useInventory";
import { INVENTORY_CATEGORIES, INVENTORY_CATEGORY_COLORS, INVENTORY_CATEGORY_ICONS } from "../../settings/inventory/constants";

// Creating here always writes to the global Settings catalog, never a local copy —
// projects only ever link to inventory items by id, with a per-project quantity.
export default function CreateInventoryItemModal({ initialName = "", onClose, onCreated }) {
  const { mutate: createItem, isPending } = useCreateInventoryItem();
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState("Robots");
  const [unit, setUnit] = useState("pcs");
  const [error, setError] = useState("");

  const submit = () => {
    if (!name.trim()) { setError("Name is required"); return; }
    createItem({ name: name.trim(), category, unit: unit.trim() || "pcs", description: "" }, {
      onSuccess: (newItem) => { onCreated(newItem.id); onClose(); },
    });
  };

  const color = INVENTORY_CATEGORY_COLORS[category] || INVENTORY_CATEGORY_COLORS.Other;
  const Icon = INVENTORY_CATEGORY_ICONS[category] || INVENTORY_CATEGORY_ICONS.Other;

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,38,69,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#fff", borderRadius: "18px", width: "100%", maxWidth: "440px", boxShadow: "0 24px 64px rgba(0,0,0,0.25)", overflow: "hidden" }}>
        <div style={{ padding: "18px 22px", background: "linear-gradient(135deg,#1a3550 0%,#25476a 60%,#2e7db5 100%)", display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ width: "38px", height: "38px", borderRadius: "11px", backgroundColor: "rgba(255,255,255,0.14)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon size={18} />
          </span>
          <div>
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "#fff" }}>New Inventory Item</h2>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>Added to the shared catalog in Settings</p>
          </div>
        </div>
        <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: "12px" }}>
          {error && (
            <div style={{ padding: "9px 12px", background: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "9px", color: "#EF4444", fontSize: "12.5px" }}>
              {error}
            </div>
          )}
          <div>
            <label style={{ fontSize: "12px", fontWeight: "700", color: "#374151", display: "block", marginBottom: "5px" }}>Name *</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Quarky Board"
              style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: "9px", border: "1.5px solid #E5E7EB", fontSize: "13px", fontFamily: "Inter, sans-serif", outline: "none" }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: "700", color: "#374151", display: "block", marginBottom: "5px" }}>Category</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color, display: "flex", pointerEvents: "none" }}>
                  <Icon size={14} />
                </span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px 9px 32px", borderRadius: "9px", border: "1.5px solid #E5E7EB", fontSize: "13px", fontFamily: "Inter, sans-serif", outline: "none", background: "#fff" }}
                >
                  {INVENTORY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize: "12px", fontWeight: "700", color: "#374151", display: "block", marginBottom: "5px" }}>Unit</label>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="e.g. pcs, set, kit"
                style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: "9px", border: "1.5px solid #E5E7EB", fontSize: "13px", fontFamily: "Inter, sans-serif", outline: "none" }}
              />
            </div>
          </div>
        </div>
        <div style={{ padding: "14px 22px", display: "flex", gap: "10px", justifyContent: "flex-end", borderTop: "1px solid #F3F4F6" }}>
          <button type="button" onClick={onClose} style={{ padding: "9px 16px", background: "#fff", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: "9px", fontSize: "13px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            style={{ padding: "9px 18px", background: isPending ? "#fde3b0" : "#feb139", color: "#25476a", border: "none", borderRadius: "9px", fontSize: "13px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: isPending ? "not-allowed" : "pointer" }}
          >
            {isPending ? "Creating…" : "Create Item"}
          </button>
        </div>
      </div>
    </div>
  );
}
