import { useState, useEffect, useRef } from "react";
import { FiEdit2, FiMoreVertical, FiRepeat, FiTrash2 } from "react-icons/fi";

// Edit / Move to Goods-or-Services / Delete menu on an item card (Goods and Services panels).
export default function CardKebab({ onEdit, onMove, moveLabel, onDelete }) {
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
          {onMove && (
            <button type="button" className="stg-menu-item" onClick={() => { setOpen(false); onMove(); }}>
              <FiRepeat size={13} strokeWidth={2} />
              {moveLabel}
            </button>
          )}
          <button type="button" className="stg-menu-item stg-menu-item--danger" onClick={() => { setOpen(false); onDelete(); }}>
            <FiTrash2 size={13} strokeWidth={2} />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
