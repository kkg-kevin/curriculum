import { useState } from "react";
import { Link } from "react-router-dom";
import { FiBookOpen, FiChevronDown, FiExternalLink, FiFolder, FiSearch, FiUsers } from "react-icons/fi";
import { usePathwayDirectory } from "../hooks/usePathwayTemplates";
import RichContent, { isEmptyHtml } from "../../../courses/components/RichContent";

const ages = (s) => (s.minAge != null && s.maxAge != null ? ` (${s.minAge}–${s.maxAge} yrs)` : "");

function CourseList({ courses, color }) {
  if (!courses.length) return <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9CA3AF", fontStyle: "italic" }}>No courses yet</p>;
  return (
    <div className="stg-course-list">
      {courses.map((c) => (
        <div key={c.id} className="stg-course-row">
          <span className="stg-course-dot" style={{ backgroundColor: color }} />
          <span className="stg-course-name">{c.name}</span>
        </div>
      ))}
    </div>
  );
}

function PathwayCard({ pathway }) {
  const color = pathway.color || "#25476a";
  const [open, setOpen] = useState(false);
  const curricula = pathway.curricula.length;
  return (
    <div className="stg-item">
      <div className="stg-item-top" style={{ cursor: "pointer" }} onClick={() => setOpen((v) => !v)}>
        <div className="stg-item-dot" style={{ backgroundColor: color }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="stg-item-name">{pathway.name}</div>
          <div style={{ fontSize: 11.5, color: "#9CA3AF", marginTop: 2 }}>
            {pathway.inUse
              ? `${curricula} curricul${curricula === 1 ? "um" : "a"} · ${pathway.courseCount} course${pathway.courseCount === 1 ? "" : "s"} · ${pathway.learnerCount} learner${pathway.learnerCount === 1 ? "" : "s"}`
              : `${pathway.courseCount} course${pathway.courseCount === 1 ? "" : "s"} · not in any curriculum`}
          </div>
        </div>
        <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", ...(pathway.inUse ? { color: "#047857", backgroundColor: "#ECFDF5", border: "1px solid #A7F3D0" } : { color: "#6B7280", backgroundColor: "#F3F4F6", border: "1px solid #E5E7EB" }) }}>
          {pathway.inUse ? "In use" : "Not in use"}
        </span>
        <FiChevronDown size={14} strokeWidth={2} style={{ color: "#9CA3AF", flexShrink: 0, transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "none" }} />
      </div>

      {open && (
        <div style={{ marginTop: 8 }}>
          {!isEmptyHtml(pathway.description) && <div className="stg-item-sub"><RichContent html={pathway.description} /></div>}

          {pathway.inUse && (
            <p style={{ margin: "6px 0 4px", fontSize: 12, color: "#6B7280" }} onClick={(e) => e.stopPropagation()}>
              Shown on the website, its hubs and its plans: <Link to="/billing?tab=packages" style={{ color: "#2e7db5", fontWeight: 700 }}>Billing → Packages → Pathway plans</Link>.
            </p>
          )}
          {pathway.inUse ? (
            pathway.curricula.map((c) => (
              <div key={c.curriculumId} className="stg-course-section">
                <div className="stg-course-header">
                  <div className="stg-course-header-left">
                    <FiBookOpen size={13} strokeWidth={2} style={{ color, flexShrink: 0 }} />
                    <span className="stg-course-title">{c.curriculumName}</span>
                  </div>
                  <Link to={`/curriculum/${c.curriculumId}/competencies?section=pathways`} onClick={(e) => e.stopPropagation()}
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: "#2e7db5", textDecoration: "none" }}>
                    Open in curriculum <FiExternalLink size={12} />
                  </Link>
                </div>
                {c.stages.map((s, i) => (
                  <div key={i} style={{ marginTop: 6 }}>
                    {(c.stages.length > 1 || s.stageName) && (
                      <p style={{ margin: "6px 0 2px", fontSize: 11.5, fontWeight: 700, color: "#6B7280" }}>{s.stageName || "No stage"}{ages(s)}</p>
                    )}
                    <CourseList courses={s.courses} color={color} />
                  </div>
                ))}
              </div>
            ))
          ) : (
            <div className="stg-course-section">
              <div className="stg-course-header">
                <div className="stg-course-header-left">
                  <FiBookOpen size={13} strokeWidth={2} style={{ color, flexShrink: 0 }} />
                  <span className="stg-course-title">Courses</span>
                </div>
              </div>
              <CourseList courses={pathway.courses || []} color={color} />
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "#6B7280" }}>
                To use it, open a curriculum → Competency Framework → Pathways and add it there.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Settings → Pathways: the workspace's pathways, to look at — the ones its curricula use (from
// Curriculum → Competency Framework → Pathways, worked out fresh each time this opens, so a change
// made in a curriculum shows here at once), each with the curricula using it, its courses per
// stage and the learners on it; then the ones no curriculum uses yet. Nothing is added, changed or
// removed here — that's done in the curriculum ("Open in curriculum").
export default function PathwayTemplatesPanel() {
  const { data, isLoading } = usePathwayDirectory();
  const pathways = data?.pathways || [];
  const [search, setSearch] = useState("");
  const [show, setShow] = useState("all");

  const query = search.trim().toLowerCase();
  const inUseCount = pathways.filter((p) => p.inUse).length;
  const filtered = pathways
    .filter((p) => show === "all" || (show === "used" ? p.inUse : !p.inUse))
    .filter((p) => !query || p.name.toLowerCase().includes(query) || p.curricula.some((c) => c.curriculumName.toLowerCase().includes(query)));

  if (isLoading) return <div className="stg-spinner" />;

  const tab = (key, label) => (
    <button type="button" onClick={() => setShow(key)}
      style={{ padding: "6px 12px", borderRadius: 20, border: `1.5px solid ${show === key ? "#25476a" : "#E5E7EB"}`, backgroundColor: show === key ? "#25476a" : "#fff", color: show === key ? "#fff" : "#374151", fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
      {label}
    </button>
  );

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0F2645" }}>Pathways</h2>
        <p style={{ margin: "3px 0 0", fontSize: 12, color: "#9CA3AF", lineHeight: 1.5 }}>
          {inUseCount} in use in your curricula, {pathways.length - inUseCount} not in use. To add, change or remove a pathway, open the curriculum
          (Competency Framework → Pathways) — changes made there show here straight away. How each one is sold on the website — shown or not, its hubs and plans — is in Billing → Packages → Pathway plans.
        </p>
      </div>

      {pathways.length === 0 ? (
        <div className="stg-empty">
          <div style={{ marginBottom: 12, color: "#25476a" }}><FiFolder size={40} strokeWidth={1.8} /></div>
          <p style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800, color: "#374151" }}>No pathways yet</p>
          <p style={{ margin: 0, fontSize: 13, color: "#9CA3AF", maxWidth: 360, marginInline: "auto", lineHeight: 1.6 }}>
            Pathways are added in a curriculum: Curriculum → Competency Framework → Pathways.
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
            {tab("all", `All (${pathways.length})`)}
            {tab("used", `In use (${inUseCount})`)}
            {tab("unused", `Not in use (${pathways.length - inUseCount})`)}
          </div>
          <div className="stg-search-wrap">
            <FiSearch size={14} className="stg-search-icon" />
            <input className="stg-search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search pathways or curricula…" />
          </div>
          {filtered.length === 0 ? (
            <div className="stg-empty" style={{ padding: "40px 24px" }}>
              <div style={{ marginBottom: 10, color: "#25476a" }}><FiSearch size={32} strokeWidth={1.8} /></div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#374151" }}>No pathways match</p>
            </div>
          ) : (
            <div className="stg-list">
              {filtered.map((pw) => <PathwayCard key={pw.key} pathway={pw} />)}
            </div>
          )}
          <p style={{ margin: "12px 0 0", fontSize: 11.5, color: "#9CA3AF", display: "flex", alignItems: "center", gap: 5 }}>
            <FiUsers size={12} /> Learners counts each learner on the pathway once, across every curriculum.
          </p>
        </>
      )}
    </div>
  );
}
