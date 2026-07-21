import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiBookOpen } from "react-icons/fi";
import { courseHomePath } from "../../../routes/portalPaths";

function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function CatalogCard({ role, course }) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const sessionCount = course.sessionCount ?? 0;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => navigate(courseHomePath(role, course.id))}
      style={{
        backgroundColor: "#ffffff", borderRadius: 16, cursor: "pointer",
        boxShadow: hovered ? "0 8px 24px rgba(37,71,106,0.12), 0 2px 6px rgba(0,0,0,0.05)" : "0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)",
        display: "flex", flexDirection: "column", overflow: "hidden",
        transition: "box-shadow 0.2s, transform 0.2s",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
      }}
    >
      <div style={{ height: 140, flexShrink: 0 }}>
        {course.coverImage ? (
          <img src={course.coverImage} alt={course.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #1a3550, #25476a)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, color: "#fff" }}>
            <FiBookOpen />
          </div>
        )}
      </div>

      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
          {course.name}
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#38aae1", fontWeight: 600 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {sessionCount} lesson{sessionCount !== 1 ? "s" : ""}
        </div>
        <p style={{ margin: 0, fontSize: 13, color: "#6B7280", lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {stripHtml(course.description) || <span style={{ fontStyle: "italic", color: "#D1D5DB" }}>No description added</span>}
        </p>
      </div>
    </div>
  );
}

export default function CourseCatalogGrid({ role, courses }) {
  if (courses.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 24px", backgroundColor: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB" }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg, #e8f5fb, #d6edf8)", border: "2px solid #a8d5ee", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px", color: "#25476a" }}><FiBookOpen /></div>
        <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#111827" }}>No courses yet</h3>
        <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>No courses have been added to this curriculum yet.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
      {courses.map((c) => <CatalogCard key={c.id} role={role} course={c} />)}
    </div>
  );
}
