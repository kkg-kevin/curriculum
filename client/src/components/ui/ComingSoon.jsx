import { FiTool } from "react-icons/fi";

export default function ComingSoon({ name }) {
  return (
    <div style={{ fontFamily: "Inter, sans-serif", padding: "40px 24px", textAlign: "center", color: "#9CA3AF" }}>
      <div style={{ display: "flex", justifyContent: "center", margin: "0 0 12px" }}><FiTool size={30} /></div>
      <p style={{ fontSize: "16px", fontWeight: "700", color: "#374151", margin: "0 0 6px" }}>{name}</p>
      <p style={{ fontSize: "13px", margin: 0 }}>This module is coming soon.</p>
    </div>
  );
}
