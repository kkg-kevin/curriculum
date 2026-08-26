import { useState, useEffect, useRef } from "react";
import { FiEdit2, FiMoreVertical, FiSearch, FiTag, FiTrash2 } from "react-icons/fi";
import { useItems, useCreateItem, useUpdateItem, useDeleteItem } from "../hooks/useItems";
import { Modal, Label } from "../../components/Modal";
import ConfirmDialog from "../../../curriculum/components/ConfirmDialog";

const INVOICE_TYPE_LABELS = { hub_subscription: "Hub subscription", learner_term: "Learner per term", course_module: "Course / module", bootcamp: "One-time bootcamp" };

function formatMoney(amount) { return amount === null || amount === undefined ? null : `KES ${Number(amount).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

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

function ItemModal({ editTarget, onClose }) {
  const { mutate: create, isPending: creating } = useCreateItem();
  const { mutate: update, isPending: updating } = useUpdateItem();
  const isPending = creating || updating;

  const [form, setForm] = useState(() => ({
    name: editTarget?.name || "",
    description: editTarget?.description || "",
    defaultPrice: editTarget?.defaultPrice ?? "",
    unit: editTarget?.unit || "item",
    invoiceType: editTarget?.invoiceType || "",
  }));
  const [error, setError] = useState("");
  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = () => {
    if (!form.name.trim()) { setError("Name is required"); return; }
    const data = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      defaultPrice: form.defaultPrice === "" ? null : Number(form.defaultPrice),
      unit: form.unit.trim() || "item",
      invoiceType: form.invoiceType || null,
    };
    const onSuccess = () => onClose();
    if (editTarget) update({ id: editTarget.id, data }, { onSuccess });
    else create(data, { onSuccess });
  };

  return (
    <Modal
      title={editTarget ? "Edit Item" : "Add Item"}
      subtitle="Billable catalog — pick one when creating an invoice to prefill description and amount"
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
          <input className="stg-input" value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="e.g. Term Tuition Fee" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <div>
            <Label>Default price (KES)</Label>
            <input type="number" min="0" step="0.01" className="stg-input" value={form.defaultPrice} onChange={(e) => setField("defaultPrice", e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <Label>Unit label</Label>
            <input className="stg-input" value={form.unit} onChange={(e) => setField("unit", e.target.value)} placeholder="e.g. per term, one-time" />
          </div>
        </div>
        <div>
          <Label>Invoice type (optional)</Label>
          <select className="stg-input" value={form.invoiceType} onChange={(e) => setField("invoiceType", e.target.value)}>
            <option value="">Any</option>
            {Object.entries(INVOICE_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div>
          <Label>Description</Label>
          <textarea rows={3} className="stg-textarea" value={form.description} onChange={(e) => setField("description", e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}

function ItemCard({ item, onEdit, onDelete }) {
  const price = formatMoney(item.defaultPrice);
  return (
    <div
      style={{ backgroundColor: "#fff", borderRadius: "16px", border: "1.5px solid #E5E7EB", display: "flex", flexDirection: "column", overflow: "hidden", transition: "box-shadow 0.15s, transform 0.15s", animation: "stg-fadein 0.18s ease" }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 6px 20px rgba(37,71,106,0.1)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <p style={{ margin: 0, fontSize: "14.5px", fontWeight: "700", color: "#111827", lineHeight: 1.3 }}>{item.name}</p>
          <CardKebab onEdit={onEdit} onDelete={onDelete} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span className="stg-chip" style={{ borderColor: "#38aae140", color: "#25476a", fontWeight: 800 }}>{price || "No default price"}</span>
          <span style={{ fontSize: "11.5px", color: "#9CA3AF" }}>{item.unit}</span>
          {item.invoiceType && <span style={{ fontSize: "11.5px", color: "#9CA3AF" }}>· {INVOICE_TYPE_LABELS[item.invoiceType]}</span>}
        </div>
        <p className="stg-comp-desc" style={{ WebkitLineClamp: 2 }}>
          {item.description || <em style={{ color: "#D1D5DB" }}>No description added</em>}
        </p>
      </div>
    </div>
  );
}

export default function ItemsPanel() {
  const { data: items = [], isLoading } = useItems();
  const { mutate: deleteItem } = useDeleteItem();
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
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0F2645" }}>Items</h2>
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
            <FiTag size={40} strokeWidth={1.8} />
          </div>
          <p style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: "800", color: "#374151" }}>No items yet</p>
          <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#9CA3AF", maxWidth: "360px", marginInline: "auto", lineHeight: "1.6" }}>
            Define billable items here — tuition, bootcamp fees, registration — so invoices can be created by picking one instead of typing a description and amount every time.
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
                <ItemCard
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

      {modalOpen && <ItemModal editTarget={editTarget} onClose={() => setModalOpen(false)} />}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Item"
        message={`"${deleteTarget?.name}" will be permanently deleted. This won't affect any invoice already created from it.`}
        confirmLabel="Delete" cancelLabel="Cancel" variant="danger"
        onConfirm={() => { deleteItem(deleteTarget.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
