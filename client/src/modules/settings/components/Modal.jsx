export function Label({ children }) {
  return <span className="stg-field-label">{children}</span>;
}

export function Modal({ title, subtitle, onClose, children, footer }) {
  return (
    <div className="stg-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="stg-modal">
        <div className="stg-modal-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#fff" }}>{title}</h2>
            {subtitle && <p style={{ margin: "4px 0 0", fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>{subtitle}</p>}
          </div>
          <button type="button" className="stg-modal-close" onClick={onClose}>×</button>
        </div>
        <div style={{ padding: "22px 24px" }}>{children}</div>
        <div style={{ padding: "16px 24px", display: "flex", gap: "10px", justifyContent: "flex-end", borderTop: "1px solid #F3F4F6" }}>
          {footer}
        </div>
      </div>
    </div>
  );
}
