import { FiAlertTriangle } from "react-icons/fi";

// What a record is still used by (the server's modules/usage — `usage.usages`): "3 classes —
// Grade 4 Blue, Grade 5…". Shown by ConfirmDialog before a delete and by InUseNotice after a
// refused one.
export default function UsageList({ usage, intro = "It can't be deleted while it's in use:" }) {
  const usages = usage?.usages || [];
  if (!usages.length) return null;
  return (
    <div style={{ padding: "12px 14px", borderRadius: 12, background: "#FFFBEB", border: "1px solid #FDE68A", fontFamily: "Inter, sans-serif" }}>
      <p style={{ margin: "0 0 8px", display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, color: "#92400E" }}>
        <FiAlertTriangle size={15} style={{ flexShrink: 0 }} /> {intro}
      </p>
      <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 5 }}>
        {usages.map((u) => (
          <li key={u.key} style={{ fontSize: 13, color: "#78350F", lineHeight: 1.45 }}>
            <strong>{u.label}</strong>
            {u.examples?.length > 0 && (
              <span style={{ color: "#92400E" }}> — {u.examples.join(", ")}{u.count > u.examples.length ? ", …" : ""}</span>
            )}
          </li>
        ))}
      </ul>
      <p style={{ margin: "8px 0 0", fontSize: 12, color: "#92400E" }}>Remove or reassign these first, then delete it.</p>
    </div>
  );
}
