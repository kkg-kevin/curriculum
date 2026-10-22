import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiCheck, FiFolder, FiFolderPlus, FiMoreVertical, FiSearch, FiX } from "react-icons/fi";
import ImageUploadField from "../ImageUploadField";

// Folders on a list page (Courses, Assessments): the folder tiles, and the small dialogs to name a
// folder, fill it, and move one record between folders. `noun` names what's being filed —
// { one: "course", many: "courses", example? } — so the same pieces read right on either page.

const font = "Inter, sans-serif";
export const FOLDER_COLORS = ["#25476a", "#2e7db5", "#38aae1", "#059669", "#d97706", "#dc2626", "#7c3aed", "#db2777"];
const inputStyle = { width: "100%", boxSizing: "border-box", border: "1.5px solid #E5E7EB", borderRadius: 10, padding: "10px 12px", fontSize: 14, fontFamily: font, outline: "none" };
const primaryBtn = { padding: "10px 18px", backgroundColor: "#25476a", color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 700, fontFamily: font, cursor: "pointer" };
const countLabel = (n, noun) => `${n} ${n === 1 ? noun.one : noun.many}`;
const ghostBtn = { padding: "10px 16px", backgroundColor: "#fff", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 13.5, fontWeight: 600, fontFamily: font, cursor: "pointer" };

function Modal({ title, onClose, children, footer, width = 460 }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.45)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-label={title} style={{ width: "100%", maxWidth: width, maxHeight: "86vh", display: "flex", flexDirection: "column", backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 20px 50px rgba(0,0,0,0.25)", fontFamily: font }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "18px 20px 12px" }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#111827" }}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: "none", background: "#F3F4F6", width: 30, height: 30, borderRadius: 8, cursor: "pointer", color: "#6B7280", display: "flex", alignItems: "center", justifyContent: "center" }}><FiX size={15} /></button>
        </div>
        <div style={{ padding: "4px 20px 16px", overflowY: "auto" }}>{children}</div>
        {footer && <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 20px 18px", borderTop: "1px solid #F3F4F6" }}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** One folder on a list page. `onMenu` gets "rename" | "delete". */
export function FolderTile({ folder, noun, onOpen, onMenu }) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);
  const color = folder.color || "#25476a";
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative", display: "flex", flexDirection: "column", borderRadius: 16, cursor: "pointer", backgroundColor: "#fff", fontFamily: font,
        boxShadow: hovered ? "0 8px 24px rgba(37,71,106,0.12), 0 2px 6px rgba(0,0,0,0.05)" : "0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)",
        transform: hovered ? "translateY(-2px)" : "translateY(0)", transition: "box-shadow 0.2s, transform 0.2s",
      }}
    >
      {/* Same shape as a course card: the folder's image (or a folder icon) on top. The folder's own
          colour shows on hover — filling the panel, or as a tint over the image. */}
      <div style={{ position: "relative", height: 140, flexShrink: 0, borderRadius: "16px 16px 0 0", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: hovered ? color : "#EEF3F8", color: hovered ? "#fff" : "#94A3B8", transition: "background-color 0.2s, color 0.2s" }}>
        {folder.coverImage ? (
          <>
            <img src={folder.coverImage} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            <span style={{ position: "absolute", inset: 0, backgroundColor: color, opacity: hovered ? 0.55 : 0, transition: "opacity 0.2s" }} />
            <span style={{ position: "absolute", left: 10, bottom: 10, width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.92)", color }}><FiFolder size={16} /></span>
          </>
        ) : (
          <FiFolder size={46} strokeWidth={1.6} />
        )}
      </div>
      <span ref={menuRef} style={{ position: "absolute", top: 10, right: 10 }}>
        <button type="button" title="Folder options" onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }} style={{ width: 30, height: 30, border: "none", borderRadius: 8, background: "rgba(255,255,255,0.9)", color: "#25476a", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <FiMoreVertical size={14} />
        </button>
        {menuOpen && (
          <span style={{ position: "absolute", right: 0, top: 36, zIndex: 20, minWidth: 150, padding: 6, backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", display: "flex", flexDirection: "column" }}>
            {[["rename", "Edit folder"], ["delete", "Delete folder"]].map(([key, label]) => (
              <button key={key} type="button" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onMenu(key); }} style={{ textAlign: "left", padding: "8px 10px", border: "none", background: "none", borderRadius: 8, fontSize: 13, fontFamily: font, cursor: "pointer", color: key === "delete" ? "#EF4444" : "#374151" }}>
                {label}
              </button>
            ))}
          </span>
        )}
      </span>
      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{folder.name}</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#38aae1", fontWeight: 600 }}>
          <FiFolder size={13} /> {countLabel(folder.itemCount ?? 0, noun)}
        </div>
        <p style={{ margin: 0, fontSize: 13, color: "#6B7280", lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {folder.description || <span style={{ fontStyle: "italic", color: "#D1D5DB" }}>No description added</span>}
        </p>
      </div>
    </div>
  );
}

/** A "New folder" card that sits after the folders, the same size as one. */
export function NewFolderTile({ onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ minHeight: 210, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 16, border: `1.5px dashed ${hovered ? "#38aae1" : "#A8D5EE"}`, backgroundColor: hovered ? "#F1F9FD" : "#F8FBFE", color: "#25476a", fontSize: 14, fontWeight: 700, fontFamily: font, cursor: "pointer", transition: "background-color 0.2s, border-color 0.2s" }}
    >
      <span style={{ width: 52, height: 52, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#E8F5FB" }}><FiFolderPlus size={22} /></span>
      New folder
    </button>
  );
}

/** Create or edit a folder: its name, description, image and colour. */
export function FolderDialog({ folder, noun, onSave, onClose, saving }) {
  const [name, setName] = useState(folder?.name || "");
  const [description, setDescription] = useState(folder?.description || "");
  const [coverImage, setCoverImage] = useState(folder?.coverImage || "");
  const [color, setColor] = useState(folder?.color || FOLDER_COLORS[0]);
  const submit = (e) => { e?.preventDefault(); if (name.trim()) onSave({ name: name.trim(), description: description.trim(), coverImage: coverImage || "", color }); };
  return (
    <Modal
      width={520}
      title={folder ? "Edit folder" : "New folder"}
      onClose={onClose}
      footer={<>
        <button type="button" onClick={onClose} style={ghostBtn}>Cancel</button>
        <button type="button" onClick={submit} disabled={saving || !name.trim()} style={{ ...primaryBtn, opacity: saving || !name.trim() ? 0.6 : 1 }}>{saving ? "Saving…" : folder ? "Save" : "Create folder"}</button>
      </>}
    >
      <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600, color: "#374151" }}>
          Folder name
          <input autoFocus maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Robotics, Grade 4, Holiday camps" style={inputStyle} />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600, color: "#374151" }}>
          Description <span style={{ fontWeight: 400, color: "#9CA3AF", marginTop: -4 }}>Optional — what the {noun.many} in this folder have in common</span>
          <textarea maxLength={2000} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={noun.example || `e.g. The ${noun.many} for Grade 4 robotics`} style={{ ...inputStyle, resize: "vertical", minHeight: 76 }} />
        </label>
        <div style={{ display: "grid", gap: 6 }}>
          <ImageUploadField label="Folder image (optional)" value={coverImage} onChange={(url) => setCoverImage(url || "")} width="100%" height="140px" />
        </div>
        <div style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600, color: "#374151" }}>
          Colour
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {FOLDER_COLORS.map((c) => (
              <button key={c} type="button" aria-label={`Colour ${c}`} onClick={() => setColor(c)} style={{ width: 28, height: 28, borderRadius: "50%", border: color === c ? "3px solid #111827" : "3px solid transparent", backgroundColor: c, cursor: "pointer", boxShadow: "0 0 0 1px #E5E7EB" }} />
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}

/** Pick records to put in `folder` (ones already in it aren't offered). `detail(item)` is the
 * short text shown beside each name (a course's code, an assessment's type), searched too. */
export function AddItemsDialog({ folder, items, folders, noun, detail = () => "", onAdd, onClose, saving }) {
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState(() => new Set());
  const folderName = useMemo(() => new Map(folders.map((f) => [f.id, f.name])), [folders]);
  const candidates = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items
      .filter((item) => item.folderId !== folder.id)
      .filter((item) => !query || item.name.toLowerCase().includes(query) || String(detail(item) || "").toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, folder.id, search, detail]);
  const toggle = (id) => setPicked((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  return (
    <Modal
      title={`Add ${noun.many} to “${folder.name}”`}
      onClose={onClose}
      width={540}
      footer={<>
        <button type="button" onClick={onClose} style={ghostBtn}>Cancel</button>
        <button type="button" disabled={saving || picked.size === 0} onClick={() => onAdd([...picked])} style={{ ...primaryBtn, opacity: saving || picked.size === 0 ? 0.6 : 1 }}>
          {saving ? "Adding…" : picked.size ? `Add ${countLabel(picked.size, noun)}` : `Add ${noun.many}`}
        </button>
      </>}
    >
      <div style={{ position: "relative", marginBottom: 12 }}>
        <FiSearch size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }} />
        <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${noun.many}…`} style={{ ...inputStyle, paddingLeft: 34 }} />
      </div>
      {candidates.length === 0 ? (
        <p style={{ margin: "18px 0", textAlign: "center", fontSize: 13, color: "#9CA3AF" }}>{search.trim() ? `No ${noun.many} match.` : `Every ${noun.one} is already in this folder.`}</p>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          {candidates.map((item) => {
            const on = picked.has(item.id);
            const extra = detail(item);
            return (
              <button key={item.id} type="button" onClick={() => toggle(item.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${on ? "#38aae1" : "#EEF0F2"}`, backgroundColor: on ? "#F1F9FD" : "#fff", cursor: "pointer", textAlign: "left", fontFamily: font }}>
                <span style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: on ? "#38aae1" : "#fff", border: on ? "none" : "1.5px solid #D1D5DB", color: "#fff" }}>{on && <FiCheck size={13} />}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "#111827" }}>{item.name}</span>
                  {item.folderId && <span style={{ display: "block", fontSize: 11.5, color: "#9CA3AF" }}>Moves from “{folderName.get(item.folderId) || "another folder"}”</span>}
                </span>
                {extra && <span style={{ fontSize: 11.5, color: "#9CA3AF" }}>{extra}</span>}
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

/** Move one record into a folder, or out of all folders. */
export function MoveToFolderDialog({ item, folders, onMove, onNewFolder, onClose, saving }) {
  const [target, setTarget] = useState(item.folderId || "");
  const options = [{ id: "", name: "Not in a folder" }, ...folders];
  return (
    <Modal
      title={`Move “${item.name}”`}
      onClose={onClose}
      footer={<>
        <button type="button" onClick={onClose} style={ghostBtn}>Cancel</button>
        <button type="button" disabled={saving || target === (item.folderId || "")} onClick={() => onMove(target)} style={{ ...primaryBtn, opacity: saving || target === (item.folderId || "") ? 0.6 : 1 }}>{saving ? "Moving…" : "Move"}</button>
      </>}
    >
      <div style={{ display: "grid", gap: 6 }}>
        {options.map((f) => {
          const on = target === f.id;
          return (
            <button key={f.id || "none"} type="button" onClick={() => setTarget(f.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${on ? "#38aae1" : "#EEF0F2"}`, backgroundColor: on ? "#F1F9FD" : "#fff", cursor: "pointer", textAlign: "left", fontFamily: font, fontSize: 13.5, color: "#111827", fontWeight: on ? 700 : 500 }}>
              <FiFolder size={16} style={{ color: f.id ? (f.color || "#25476a") : "#9CA3AF" }} />
              <span style={{ flex: 1 }}>{f.name}</span>
              {f.id === (item.folderId || "") && <span style={{ fontSize: 11.5, color: "#9CA3AF" }}>Current</span>}
            </button>
          );
        })}
      </div>
      <button type="button" onClick={onNewFolder} style={{ marginTop: 12, border: "none", background: "none", color: "#2e7db5", fontSize: 13, fontWeight: 700, fontFamily: font, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, padding: 0 }}>
        <FiFolderPlus size={14} /> New folder
      </button>
    </Modal>
  );
}
