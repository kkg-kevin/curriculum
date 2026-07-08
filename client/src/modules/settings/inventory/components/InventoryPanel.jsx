import { useState, useEffect, useRef } from "react";
import {
  useInventory, useCreateInventoryItem, useUpdateInventoryItem, useDeleteInventoryItem,
} from "../hooks/useInventory";
import { INVENTORY_CATEGORIES, INVENTORY_CATEGORY_COLORS, INVENTORY_CATEGORY_ICONS } from "../constants";
import { Modal, Label } from "../../components/Modal";
import ConfirmDialog from "../../../curriculum/components/ConfirmDialog";

function CardKebab({ onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button type="button" className="stg-kebab-btn" onClick={() => setOpen((v) => !v)} title="Options">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
        </svg>
      </button>
      {open && (
        <div className="stg-menu">
          <button type="button" className="stg-menu-item" onClick={() => { setOpen(false); onEdit(); }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Edit
          </button>
          <button type="button" className="stg-menu-item stg-menu-item--danger" onClick={() => { setOpen(false); onDelete(); }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function InventoryItemModal({ editTarget, onClose }) {
  const { mutate: create, isPending: creating } = useCreateInventoryItem();
  const { mutate: update, isPending: updating } = useUpdateInventoryItem();
  const isPending = creating || updating;

  const [form, setForm] = useState(() => ({
    name: editTarget?.name || "",
    category: editTarget?.category || "Robots",
    unit: editTarget?.unit || "pcs",
    description: editTarget?.description || "",
  }));
  const [error, setError] = useState("");
  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = () => {
    if (!form.name.trim()) { setError("Name is required"); return; }
    const data = {
      name: form.name.trim(),
      category: form.category,
      unit: form.unit.trim() || "pcs",
      description: form.description.trim(),
    };
    const onSuccess = () => onClose();
    if (editTarget) update({ id: editTarget.id, data }, { onSuccess });
    else create(data, { onSuccess });
  };

  return (
    <Modal
      title={editTarget ? "Edit Inventory Item" : "Add Inventory Item"}
      subtitle="Shared catalog — Projects link materials from here with a quantity"
      onClose={onClose}
      footer={<>
        <button type="button" className="stg-btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="stg-btn-primary" onClick={submit} disabled={isPending}>
          {isPending ? "Saving…" : editTarget ? "Save Changes" : "Add Item"}
        </button>
      </>}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {error && <div style={{ padding: "10px 14px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "10px", color: "#EF4444", fontSize: "13px" }}>{error}</div>}
        <div>
          <Label>Name *</Label>
          <input className="stg-input" value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="e.g. LEGO Mindstorms Kit" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <div>
            <Label>Category</Label>
            <select className="stg-input" value={form.category} onChange={(e) => setField("category", e.target.value)}>
              {INVENTORY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <Label>Unit</Label>
            <input className="stg-input" value={form.unit} onChange={(e) => setField("unit", e.target.value)} placeholder="e.g. pcs, set, kit" />
          </div>
        </div>
        <div>
          <Label>Description</Label>
          <textarea rows={4} className="stg-textarea" value={form.description} onChange={(e) => setField("description", e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}

function InventoryCard({ item, onEdit, onDelete }) {
  const color = INVENTORY_CATEGORY_COLORS[item.category] || INVENTORY_CATEGORY_COLORS.Other;
  const Icon = INVENTORY_CATEGORY_ICONS[item.category] || INVENTORY_CATEGORY_ICONS.Other;

  return (
    <div className="stg-comp-card">
      <div className="stg-comp-card-top">
        <div className="stg-avatar" style={{ backgroundColor: `${color}15`, border: `2px solid ${color}30`, color }}>
          <Icon size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0, paddingTop: "2px" }}>
          <p style={{ margin: 0, fontSize: "14.5px", fontWeight: "700", color: "#111827", lineHeight: 1.3, wordBreak: "break-word" }}>
            {item.name}
          </p>
          <span className="stg-chip" style={{ borderColor: `${color}40`, color, marginTop: "4px" }}>{item.category}</span>
          <span style={{ marginLeft: "6px", fontSize: "11.5px", color: "#9CA3AF" }}>· unit: {item.unit}</span>
        </div>
        <CardKebab onEdit={onEdit} onDelete={onDelete} />
      </div>

      <p className="stg-comp-desc">
        {item.description || <em style={{ color: "#D1D5DB" }}>No description added</em>}
      </p>
    </div>
  );
}

export default function InventoryPanel() {
  const { data: items = [], isLoading } = useInventory();
  const { mutate: deleteItem } = useDeleteInventoryItem();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();
  const filteredItems = query ? items.filter((i) => i.name.toLowerCase().includes(query)) : items;

  if (isLoading) return <div className="stg-spinner" />;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0F2645" }}>Inventory</h2>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
            {items.length} item{items.length !== 1 ? "s" : ""} defined
          </p>
        </div>
        <button type="button" className="stg-btn-primary" onClick={() => { setEditTarget(null); setModalOpen(true); }}>
          + Add Item
        </button>
      </div>

      {items.length === 0 ? (
        <div className="stg-empty">
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>📦</div>
          <p style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: "800", color: "#374151" }}>No inventory items yet</p>
          <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#9CA3AF", maxWidth: "360px", marginInline: "auto", lineHeight: "1.6" }}>
            Define robots, components, consumables, and tools here so Projects can pull materials from a shared catalog.
          </p>
          <button type="button" className="stg-btn-primary" onClick={() => { setEditTarget(null); setModalOpen(true); }}>
            + Add Item
          </button>
        </div>
      ) : (
        <>
          <div className="stg-search-wrap">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="stg-search-icon">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              className="stg-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${items.length} item${items.length !== 1 ? "s" : ""}…`}
            />
          </div>

          {filteredItems.length === 0 ? (
            <div className="stg-empty" style={{ padding: "40px 24px" }}>
              <div style={{ fontSize: "32px", marginBottom: "10px" }}>🔍</div>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#374151" }}>No matches for "{search}"</p>
            </div>
          ) : (
            <div className="stg-grid">
              {filteredItems.map((item) => (
                <InventoryCard
                  key={item.id}
                  item={item}
                  onEdit={() => { setEditTarget(item); setModalOpen(true); }}
                  onDelete={() => setDeleteTarget(item)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {modalOpen && <InventoryItemModal editTarget={editTarget} onClose={() => setModalOpen(false)} />}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Inventory Item"
        message={`"${deleteTarget?.name}" will be permanently deleted and removed from every project that currently lists it. This cannot be undone.`}
        confirmLabel="Delete" cancelLabel="Cancel" variant="danger"
        onConfirm={() => { deleteItem(deleteTarget.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
