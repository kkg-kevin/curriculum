import { useState, useEffect, useRef } from "react";
import { FiEdit2, FiMoreVertical, FiPackage, FiSearch, FiTrash2, FiPlus, FiX } from "react-icons/fi";
import {
  useInventory, useCreateInventoryItem, useUpdateInventoryItem, useDeleteInventoryItem,
} from "../hooks/useInventory";
import { INVENTORY_CATEGORIES, INVENTORY_CATEGORY_COLORS, INVENTORY_CATEGORY_ICONS } from "../constants";
import { Modal, Label } from "../../components/Modal";
import ConfirmDialog from "../../../curriculum/components/ConfirmDialog";
import ImageUploadField from "../../../../components/ImageUploadField";

const STORE_CATEGORY_LABELS = { kit: "Robots & kits", bundle: "Bundle", accessory: "Accessory" };
const STOCK_STATUS_LABELS = { available: "Available now", preorder: "Pre-order", coming_soon: "Coming soon" };

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

// A small add/remove list of plain strings — used for "highlights" and "what you get".
function StringListEditor({ items, onChange, placeholder }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, v]);
    setDraft("");
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {items.map((it, i) => (
        <div key={i} className="stg-ind-row" style={{ marginBottom: 0 }}>
          <span style={{ flex: 1, fontSize: "12.5px", color: "#374151" }}>{it}</span>
          <button type="button" className="stg-ind-x" onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <FiX size={14} />
          </button>
        </div>
      ))}
      <div style={{ display: "flex", gap: "6px" }}>
        <input
          className="stg-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
        />
        <button type="button" className="stg-btn-secondary" onClick={add} style={{ flexShrink: 0 }}>
          <FiPlus size={14} />
        </button>
      </div>
    </div>
  );
}

// An add/remove list of { label, value } pairs — the spec table.
function SpecListEditor({ items, onChange }) {
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const add = () => {
    if (!label.trim() || !value.trim()) return;
    onChange([...items, { label: label.trim(), value: value.trim() }]);
    setLabel("");
    setValue("");
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {items.map((s, i) => (
        <div key={i} className="stg-ind-row" style={{ marginBottom: 0 }}>
          <span style={{ flex: 1, fontSize: "12.5px", color: "#374151" }}>
            <strong>{s.label}</strong>{" — "}{s.value}
          </span>
          <button type="button" className="stg-ind-x" onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <FiX size={14} />
          </button>
        </div>
      ))}
      <div style={{ display: "flex", gap: "6px" }}>
        <input className="stg-input" style={{ width: "38%" }} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (e.g. Power)" />
        <input
          className="stg-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="Value (e.g. USB-C rechargeable)"
        />
        <button type="button" className="stg-btn-secondary" onClick={add} style={{ flexShrink: 0 }}>
          <FiPlus size={14} />
        </button>
      </div>
    </div>
  );
}

// The "sell this on the public website" section of the inventory modal. Off by default; ticking
// "For sale on the website" reveals the shopfront fields. Mirrors the assessment builder's
// SellingPanel — an inventory item marked for_sale shows up in digifunzi-landing's /store.
function SellingSection({ form, setField }) {
  const on = form.saleStatus === "for_sale";
  const priceInvalid =
    form.compareAtAmount !== "" && form.priceAmount !== "" &&
    Number(form.compareAtAmount) <= Number(form.priceAmount);

  return (
    <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: "16px", marginTop: "4px" }}>
      <label style={{ display: "flex", alignItems: "flex-start", gap: "9px", cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => setField("saleStatus", e.target.checked ? "for_sale" : "internal")}
          style={{ marginTop: "2px", width: "15px", height: "15px", flexShrink: 0 }}
        />
        <span>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "#111827" }}>For sale on the website</span>
          <span style={{ display: "block", fontSize: "11.5px", color: "#9CA3AF", marginTop: "1px" }}>
            Appears in the public Store (africa.digifunzi.com/store). Off = internal catalog only —
            Projects can still link it.
          </span>
        </span>
      </label>

      {on && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div>
              <Label>Store category</Label>
              <select className="stg-input" value={form.storeCategory || ""} onChange={(e) => setField("storeCategory", e.target.value || null)}>
                <option value="">— pick one —</option>
                {Object.entries(STORE_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <Label>Availability</Label>
              <select className="stg-input" value={form.stockStatus} onChange={(e) => setField("stockStatus", e.target.value)}>
                {Object.entries(STOCK_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          <div>
            <Label>Short tagline</Label>
            <input className="stg-input" maxLength={200} value={form.tagline} onChange={(e) => setField("tagline", e.target.value)} placeholder="e.g. The hands-on robot at the heart of Digifunzi" />
          </div>

          <div>
            <Label>Badge <span style={{ fontWeight: 400, color: "#9CA3AF" }}>(optional)</span></Label>
            <input className="stg-input" maxLength={40} value={form.badge} onChange={(e) => setField("badge", e.target.value)} placeholder="e.g. Core kit, Best value" />
          </div>

          <div>
            <Label>Price</Label>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <input className="stg-input" style={{ width: "70px", flexShrink: 0 }} value={form.priceCurrency} onChange={(e) => setField("priceCurrency", e.target.value)} aria-label="Currency" />
              <input className="stg-input" type="number" min="0" style={{ width: "120px", flexShrink: 0 }} placeholder="14500" value={form.priceAmount} onChange={(e) => setField("priceAmount", e.target.value)} aria-label="Amount" />
              <input className="stg-input" style={{ width: "110px", flexShrink: 0 }} placeholder="unit (each…)" value={form.priceUnit} onChange={(e) => setField("priceUnit", e.target.value)} aria-label="Unit" />
              <span style={{ fontSize: "11.5px", color: "#9CA3AF" }}>Blank amount → &ldquo;Enquire for pricing&rdquo;</span>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "6px" }}>
              <input className="stg-input" type="number" min="0" style={{ width: "120px", flexShrink: 0 }} placeholder="was (optional)" value={form.compareAtAmount} onChange={(e) => setField("compareAtAmount", e.target.value)} aria-label="Compare-at price" />
              <span style={{ fontSize: "11.5px", color: priceInvalid ? "#DC2626" : "#9CA3AF" }}>
                {priceInvalid ? "Must be higher than the price" : "Optional strike-through “was” price"}
              </span>
            </div>
            <input className="stg-input" style={{ marginTop: "6px" }} maxLength={300} placeholder="Price note (e.g. School and bulk pricing available)" value={form.priceNote} onChange={(e) => setField("priceNote", e.target.value)} />
          </div>

          <div>
            <Label>Highlights <span style={{ fontWeight: 400, color: "#9CA3AF" }}>(selling points)</span></Label>
            <StringListEditor items={form.highlights} onChange={(v) => setField("highlights", v)} placeholder="Add a highlight and press Enter" />
          </div>

          <div>
            <Label>What you get</Label>
            <StringListEditor items={form.includes} onChange={(v) => setField("includes", v)} placeholder="e.g. Quarky main board with built-in sensors" />
          </div>

          <div>
            <Label>Specifications</Label>
            <SpecListEditor items={form.specs} onChange={(v) => setField("specs", v)} />
          </div>

          <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF", lineHeight: 1.5 }}>
            The Store also shows this item&rsquo;s <strong>Image</strong> and <strong>Description</strong> above.
            &ldquo;Enquire to buy&rdquo; sends a lead to Enquiries — there&rsquo;s no online checkout.
          </p>
        </div>
      )}
    </div>
  );
}

const BLANK_SALE = {
  saleStatus: "internal",
  storeCategory: null,
  stockStatus: "available",
  tagline: "",
  badge: "",
  priceAmount: "",
  priceCurrency: "KES",
  priceUnit: "",
  priceNote: "",
  compareAtAmount: "",
  highlights: [],
  includes: [],
  specs: [],
  gallery: [],
};

function saleFromItem(it) {
  return {
    saleStatus: it.saleStatus || "internal",
    storeCategory: it.storeCategory || null,
    stockStatus: it.stockStatus || "available",
    tagline: it.tagline || "",
    badge: it.badge || "",
    priceAmount: it.priceAmount ?? "",
    priceCurrency: it.priceCurrency || "KES",
    priceUnit: it.priceUnit || "",
    priceNote: it.priceNote || "",
    compareAtAmount: it.compareAtAmount ?? "",
    highlights: Array.isArray(it.highlights) ? it.highlights : [],
    includes: Array.isArray(it.includes) ? it.includes : [],
    specs: Array.isArray(it.specs) ? it.specs : [],
    gallery: Array.isArray(it.gallery) ? it.gallery : [],
  };
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
    ...(editTarget ? saleFromItem(editTarget) : BLANK_SALE),
  }));
  const [error, setError] = useState("");
  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = () => {
    if (!form.name.trim()) { setError("Name is required"); return; }
    const numOrNull = (v) => (v === "" || v == null ? null : Number(v));
    const forSale = form.saleStatus === "for_sale";

    const data = {
      name: form.name.trim(),
      category: form.category,
      unit: form.unit.trim() || "pcs",
      description: form.description.trim(),
      image: form.image,
      // Selling fields — always sent so un-ticking "for sale" clears the shopfront cleanly.
      saleStatus: forSale ? "for_sale" : "internal",
      storeCategory: forSale ? (form.storeCategory || null) : null,
      stockStatus: form.stockStatus || "available",
      tagline: form.tagline.trim(),
      badge: form.badge.trim(),
      priceAmount: numOrNull(form.priceAmount),
      priceCurrency: (form.priceCurrency || "KES").trim(),
      priceUnit: form.priceUnit.trim(),
      priceNote: form.priceNote.trim(),
      compareAtAmount: numOrNull(form.compareAtAmount),
      highlights: form.highlights,
      includes: form.includes,
      specs: form.specs,
      gallery: form.gallery,
    };

    if (
      data.compareAtAmount != null && data.priceAmount != null &&
      data.compareAtAmount <= data.priceAmount
    ) {
      setError("Compare-at price must be higher than the price");
      return;
    }

    const onSuccess = () => onClose();
    if (editTarget) update({ id: editTarget.id, data }, { onSuccess });
    else create(data, { onSuccess });
  };

  return (
    <Modal
      title={editTarget ? "Edit Inventory Item" : "Add Inventory Item"}
      subtitle="Shared catalog — Projects link materials from here; flip an item &ldquo;for sale&rdquo; to show it in the website Store"
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
          <input className="stg-input" value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="e.g. Quarky Robot Kit" />
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
          <textarea rows={4} className="stg-textarea" value={form.description} onChange={(e) => setField("description", e.target.value)} placeholder="Shown on the Store detail page if this item is for sale." />
        </div>

        <SellingSection form={form} setField={setField} />
      </div>
    </Modal>
  );
}

function InStoreBadge() {
  return (
    <span style={{ padding: "2px 8px", borderRadius: "20px", fontSize: "10px", fontWeight: 800, letterSpacing: "0.03em", backgroundColor: "#ECFDF5", color: "#059669", border: "1px solid #A7F3D0" }}>
      IN STORE
    </span>
  );
}

function InventoryCard({ item, onEdit, onDelete }) {
  const color = INVENTORY_CATEGORY_COLORS[item.category] || INVENTORY_CATEGORY_COLORS.Other;
  const Icon = INVENTORY_CATEGORY_ICONS[item.category] || INVENTORY_CATEGORY_ICONS.Other;
  const forSale = item.saleStatus === "for_sale";

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
        <div style={{ display: "flex", alignItems: "flex-start", gap: "6px", justifyContent: "space-between" }}>
          <p style={{ margin: 0, fontSize: "14.5px", fontWeight: "700", color: "#111827", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {item.name}
          </p>
          {forSale && <InStoreBadge />}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span className="stg-chip" style={{ borderColor: `${color}40`, color }}>{item.category}</span>
          <span style={{ fontSize: "11.5px", color: "#9CA3AF" }}>unit: {item.unit}</span>
        </div>
        {forSale && (
          <span style={{ fontSize: "11.5px", color: "#059669", fontWeight: 600 }}>
            {item.priceAmount != null
              ? `${item.priceCurrency || "KES"} ${Number(item.priceAmount).toLocaleString()}`
              : "Enquire for pricing"}
            {item.storeCategory ? ` · ${STORE_CATEGORY_LABELS[item.storeCategory] || item.storeCategory}` : ""}
          </span>
        )}
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
  const forSaleCount = items.filter((i) => i.saleStatus === "for_sale").length;

  if (isLoading) return <div className="stg-spinner" />;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0F2645" }}>Inventory</h2>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
            {items.length} item{items.length !== 1 ? "s" : ""} defined
            {forSaleCount > 0 && ` · ${forSaleCount} in the website Store`}
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
            Define robots, components, consumables, and tools here so Projects can pull materials from a shared catalog — and flip any item &ldquo;for sale&rdquo; to list it in the website Store.
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
        message={`"${deleteTarget?.name}" will be permanently deleted and removed from every project that currently lists it${deleteTarget?.saleStatus === "for_sale" ? ", and taken off the website Store" : ""}. This cannot be undone.`}
        confirmLabel="Delete" cancelLabel="Cancel" variant="danger"
        onConfirm={() => { deleteItem(deleteTarget.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
