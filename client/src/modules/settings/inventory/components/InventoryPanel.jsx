import { useState, useEffect, useRef } from "react";
import { FiEdit2, FiMoreVertical, FiPackage, FiSearch, FiTrash2 } from "react-icons/fi";
import {
  useInventory, useCreateInventoryItem, useUpdateInventoryItem, useDeleteInventoryItem,
} from "../hooks/useInventory";
import { INVENTORY_CATEGORIES, INVENTORY_CATEGORY_COLORS, INVENTORY_CATEGORY_ICONS } from "../constants";
import { Modal, Label } from "../../components/Modal";
import ConfirmDialog from "../../../curriculum/components/ConfirmDialog";
import ImageUploadField from "../../../../components/ImageUploadField";

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
        <FiMoreVertical size={14} strokeWidth={2} />
      </button>
      {open && (
        <div className="stg-menu">
          <button type="button" className="stg-menu-item" onClick={() => { setOpen(false); onEdit(); }}>
            <FiEdit2 size={13} strokeWidth={2} />
            Edit
          </button>
          <button type="button" className="stg-menu-item stg-menu-item--danger" onClick={() => { setOpen(false); onDelete(); }}>
            <FiTrash2 size={13} strokeWidth={2} />
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
    image: editTarget?.image || null,
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
      image: form.image,
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
          <Label>Image</Label>
          <ImageUploadField value={form.image} onChange={(url) => setField("image", url)} />
        </div>
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
    <div
      style={{
        backgroundColor: "#fff", borderRadius: "16px", border: "1.5px solid #E5E7EB",
        display: "flex", flexDirection: "column", overflow: "hidden",
        transition: "box-shadow 0.15s, transform 0.15s", animation: "stg-fadein 0.18s ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 6px 20px rgba(37,71,106,0.1)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      <div style={{ height: "140px", flexShrink: 0, position: "relative" }}>
        {item.image ? (
          <img src={item.image} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", backgroundColor: `${color}12`, display: "flex", alignItems: "center", justifyContent: "center", color }}>
            <Icon size={32} />
          </div>
        )}
        <div style={{ position: "absolute", top: "8px", right: "8px", backgroundColor: "rgba(255,255,255,0.9)", borderRadius: "8px", backdropFilter: "blur(2px)" }}>
          <CardKebab onEdit={onEdit} onDelete={onDelete} />
        </div>
      </div>

      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
        <p style={{ margin: 0, fontSize: "14.5px", fontWeight: "700", color: "#111827", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
          {item.name}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span className="stg-chip" style={{ borderColor: `${color}40`, color }}>{item.category}</span>
          <span style={{ fontSize: "11.5px", color: "#9CA3AF" }}>unit: {item.unit}</span>
        </div>
        <p className="stg-comp-desc" style={{ WebkitLineClamp: 2 }}>
          {item.description || <em style={{ color: "#D1D5DB" }}>No description added</em>}
        </p>
      </div>
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
          <div style={{ marginBottom: "12px", color: "#25476a" }}>
            <FiPackage size={40} strokeWidth={1.8} />
          </div>
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
            <FiSearch size={14} className="stg-search-icon" />
            <input
              className="stg-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${items.length} item${items.length !== 1 ? "s" : ""}…`}
            />
          </div>

          {filteredItems.length === 0 ? (
            <div className="stg-empty" style={{ padding: "40px 24px" }}>
              <div style={{ marginBottom: "10px", color: "#25476a" }}>
                <FiSearch size={32} strokeWidth={1.8} />
              </div>
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
