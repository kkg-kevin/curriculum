import { useEffect, useRef, useState } from "react";
import { FiPackage, FiPlus, FiX } from "react-icons/fi";
import { useInventory } from "../../settings/inventory/hooks/useInventory";
import { INVENTORY_CATEGORY_COLORS, INVENTORY_CATEGORY_ICONS } from "../../settings/inventory/constants";
import { useCourseInventory, useLinkCourseInventory, useUnlinkCourseInventory } from "../hooks/useCourse";
import CreateInventoryItemModal from "./CreateInventoryItemModal";

const T = { accent: "#25476a", ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB" };

// Materials this course needs from the shared Inventory catalog, with a per-course quantity —
// same link+quantity pattern a Project assessment already uses (see InventoryTab in
// AssessmentBuilderPage.jsx), adapted here to fire immediately per action (add/remove/quantity
// change) rather than batching into one big form save, since this panel lives on the course's
// own page rather than inside a single edit form.
function AddMaterialDropdown({ catalog, linkedIds, onAdd, onCreateNew }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) { setOpen(false); setQuery(""); } };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const available = catalog.filter((i) => !linkedIds.includes(i.id));
  const q = query.trim().toLowerCase();
  const filtered = q ? available.filter((i) => i.name.toLowerCase().includes(q)) : available;

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "9px", border: `1.5px solid ${T.border}`, backgroundColor: "#fff", color: T.accent, fontSize: "12.5px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
      >
        <FiPlus size={13} /> Add Material
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 20, width: "260px", backgroundColor: "#fff", border: `1px solid ${T.border}`, borderRadius: "10px", boxShadow: "0 10px 28px rgba(15,38,69,0.14), 0 2px 8px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search catalog…"
            style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "none", borderBottom: `1px solid ${T.border}`, fontSize: "12.5px", fontFamily: "Inter, sans-serif", outline: "none" }}
          />
          <div style={{ maxHeight: "220px", overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <p style={{ margin: 0, padding: "12px", fontSize: "12px", color: T.inkFaint }}>No matching items.</p>
            ) : (
              filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { onAdd(item.id); setOpen(false); setQuery(""); }}
                  style={{ display: "flex", width: "100%", boxSizing: "border-box", alignItems: "center", gap: "8px", padding: "9px 12px", border: "none", borderBottom: `1px solid #F3F4F6`, background: "none", cursor: "pointer", textAlign: "left" }}
                >
                  <span style={{ fontSize: "12.5px", color: T.ink, fontWeight: "600", flex: 1 }}>{item.name}</span>
                  <span style={{ fontSize: "10.5px", color: INVENTORY_CATEGORY_COLORS[item.category] || INVENTORY_CATEGORY_COLORS.Other }}>{item.category}</span>
                </button>
              ))
            )}
          </div>
          <button
            type="button"
            onClick={() => { onCreateNew(query.trim()); setOpen(false); setQuery(""); }}
            style={{ display: "flex", width: "100%", boxSizing: "border-box", alignItems: "center", gap: "6px", padding: "10px 12px", border: "none", borderTop: `1px solid ${T.border}`, background: "#F9FAFB", color: T.accent, fontSize: "12px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
          >
            <FiPlus size={12} /> Create new catalog item
          </button>
        </div>
      )}
    </div>
  );
}

export default function CourseInventoryPanel({ courseId }) {
  const { data: catalog = [] } = useInventory();
  const { data: inventory = [], isLoading } = useCourseInventory(courseId);
  const { mutate: linkItem } = useLinkCourseInventory(courseId);
  const { mutate: unlinkItem } = useUnlinkCourseInventory(courseId);
  const [creatingItem, setCreatingItem] = useState(null); // string | null — initialName, or null when closed

  const linkedIds = inventory.map((i) => i.id);

  return (
    <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: `1.5px solid ${T.border}`, padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "11px", fontWeight: "700", color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Materials{inventory.length ? ` · ${inventory.length}` : ""}
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: "11.5px", color: T.inkFaint }}>Robots, boards, sensors, and other materials this course needs — from the shared Settings catalog.</p>
        </div>
        <AddMaterialDropdown
          catalog={catalog}
          linkedIds={linkedIds}
          onAdd={(itemId) => linkItem({ inventoryItemId: itemId, quantity: 1 })}
          onCreateNew={(initialName) => setCreatingItem(initialName || "")}
        />
      </div>

      {isLoading ? (
        <p style={{ margin: "10px 0 0", fontSize: "12.5px", color: T.inkFaint }}>Loading…</p>
      ) : inventory.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "12px", padding: "14px", backgroundColor: "#F9FAFB", border: `1.5px dashed ${T.border}`, borderRadius: "10px" }}>
          <FiPackage size={16} style={{ color: T.inkFaint, flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: "12.5px", color: T.inkFaint }}>No materials added yet.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px" }}>
          {inventory.map((item) => {
            const color = INVENTORY_CATEGORY_COLORS[item.category] || INVENTORY_CATEGORY_COLORS.Other;
            const Icon = INVENTORY_CATEGORY_ICONS[item.category] || INVENTORY_CATEGORY_ICONS.Other;
            return (
              // Same row layout as the read-only Materials list on a Project assessment's view
              // page (AssessmentContent.jsx) — thumbnail, name+category, quantity — just with
              // the quantity pill swapped for an editable stepper and a remove button, since
              // this version is authored here rather than just displayed.
              <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", backgroundColor: "#FAFBFF", border: "1px solid #F3F4F6", borderRadius: "12px" }}>
                {item.image ? (
                  <img src={item.image} alt={item.name} style={{ width: "34px", height: "34px", borderRadius: "10px", objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <span style={{ width: "34px", height: "34px", borderRadius: "10px", backgroundColor: `${color}15`, color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={16} />
                  </span>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.name}
                  </p>
                  <span style={{ fontSize: "11.5px", color: T.inkFaint }}>{item.category}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "2px", padding: "3px 4px 3px 10px", borderRadius: "999px", backgroundColor: `${color}12` }}>
                    <button type="button" onClick={() => linkItem({ inventoryItemId: item.id, quantity: Math.max(1, item.quantity - 1) })} disabled={item.quantity <= 1} style={{ width: "18px", height: "18px", border: "none", background: "none", color, fontSize: "13px", fontWeight: "700", cursor: item.quantity <= 1 ? "not-allowed" : "pointer", opacity: item.quantity <= 1 ? 0.4 : 1 }}>−</button>
                    <input
                      type="number" min="1" value={item.quantity}
                      onChange={(e) => linkItem({ inventoryItemId: item.id, quantity: Math.max(1, Number(e.target.value) || 1) })}
                      style={{ width: "26px", textAlign: "center", border: "none", background: "none", fontSize: "12px", fontWeight: "700", color, fontFamily: "Inter, sans-serif", outline: "none" }}
                    />
                    <span style={{ fontSize: "11px", fontWeight: "700", color, marginRight: "2px" }}>{item.unit}</span>
                    <button type="button" onClick={() => linkItem({ inventoryItemId: item.id, quantity: item.quantity + 1 })} style={{ width: "18px", height: "18px", border: "none", background: "none", color, fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>+</button>
                  </div>
                  <button
                    type="button"
                    onClick={() => unlinkItem(item.id)}
                    title="Remove"
                    style={{ width: "22px", height: "22px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "7px", border: "none", background: "none", color: T.inkFaint, cursor: "pointer" }}
                  >
                    <FiX size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {creatingItem !== null && (
        <CreateInventoryItemModal
          initialName={creatingItem}
          onClose={() => setCreatingItem(null)}
          onCreated={(newItemId) => linkItem({ inventoryItemId: newItemId, quantity: 1 })}
        />
      )}
    </div>
  );
}
