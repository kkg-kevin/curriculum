import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Edit as EditIcon,
  MenuBook as MenuBookIcon,
  WarningAmber as WarningAmberIcon,
  CheckCircleOutlined as CheckCircleOutlineIcon,
  Search as SearchIcon,
  Coffee as CoffeeIcon,
  AccountTree as AccountTreeIcon,
  CalendarMonth as CalendarMonthIcon,
  FolderCopy as FolderCopyIcon,
  School as SchoolIcon,
  TrackChanges as TrackChangesIcon,
  Folder as FolderIcon,
  TrendingUp as TrendingUpIcon,
  BarChart as BarChartIcon,
  LocationOn as LocationOnIcon,
  Home as HomeIcon,
  MoreVert as MoreVertIcon,
  ArrowForward as ArrowForwardIcon,
} from "@mui/icons-material";
import { useCurriculumQuery, useCurriculumCourses, useLinkCourse, useUnlinkCourse } from "../hooks/useCurriculum";
import { useCurriculumVersions } from "../hooks/useCurriculumVersion";
import { useAcademicYears } from "../hooks/useAcademicYear";
import {
  useCompetencies, usePathways, useAgeCategories, useProgressLevels,
  useAssessmentTypes, useEvidenceTypes, usePerformanceBands,
} from "../hooks/useCompetencies";
import { useSystemLevels } from "../../settings/system-levels/hooks/useSystemLevels";
import { learningHubApi as schoolApi } from "../../learning-hubs/services/learningHubApi";
import { useCoursesQuery } from "../../courses/hooks/useCourse";
import { useProgramsByCurriculumQuery } from "../../programs/hooks/usePrograms";

/* ── Helpers ──────────────────────────────────────────────────────────── */

const cycleLabel = (model) =>
  model === "semesters" ? "Semesters" : model === "terms" ? "Terms" : "Periods";

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function resolvePeriodDates(periodName, activeYear, curriculumPeriods) {
  if (activeYear?.periods) {
    const p = activeYear.periods.find((ap) => ap.name.trim() === periodName?.trim());
    if (p) return p;
  }
  const p = (curriculumPeriods || []).find((cp) => cp.name?.trim() === periodName?.trim());
  if (!p) return null;
  return {
    ...p,
    breakStartDate: p.breakStartDate || p.midTermBreakStartDate || "",
    breakEndDate:   p.breakEndDate   || p.midTermBreakEndDate   || "",
  };
}

const STATUS_CONFIG = {
  published: { bg: "#fff8e6", color: "#b07800", border: "#fcd97a", dot: "#feb139", label: "Published" },
  active:    { bg: "#e8f5fb", color: "#25476a", border: "#a8d5ee", dot: "#38aae1", label: "Active"    },
  draft:     { bg: "#FFFBEB", color: "#92400E", border: "#FDE68A", dot: "#D97706", label: "Draft"     },
  inactive:  { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB", dot: "#9CA3AF", label: "Inactive"  },
  archived:  { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB", dot: "#9CA3AF", label: "Archived"  },
};

// Program deployment status — computed server-side (program.service.js's computeStatus) from a
// deployment's own start/end dates, distinct from the curriculum version's draft/published status.
const DEPLOYMENT_STATUS = {
  upcoming:  { bg: "#fff8e6", color: "#b07800", border: "#fcd97a", label: "Upcoming"  },
  active:    { bg: "#e8f5fb", color: "#25476a", border: "#a8d5ee", label: "Active"    },
  completed: { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB", label: "Completed" },
};

const COURSE_SHADES = [
  { bg: "#e8f5fb", color: "#25476a", border: "#a8d5ee" },
  { bg: "#d6edf8", color: "#2e7db5", border: "#b8d9ee" },
  { bg: "#E0F2FE", color: "#38aae1", border: "#a8d5ee" },
  { bg: "#F0F7FF", color: "#25476a", border: "#C7D9F8" },
];

/* ── CSS ─────────────────────────────────────────────────────────────── */

const CSS = `
  @keyframes cvp-spin { to { transform: rotate(360deg); } }
  @keyframes cvp-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

  /* Period tabs strip */
  .cvp-period-tabs {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    padding: 14px 20px;
    border-bottom: 1px solid #F3F4F6;
    background: #FAFBFF;
  }

  .cvp-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px 16px;
    border-radius: 12px;
    border: 1.5px solid #E5E7EB;
    background: #fff;
    font-family: Inter, sans-serif;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
    min-width: 80px;
  }
  .cvp-tab-name  { font-size: 13px; font-weight: 700; color: #374151; line-height: 1.2; }
  .cvp-tab-dates { font-size: 10px; font-weight: 500; color: #9CA3AF; line-height: 1.2; }
  .cvp-tab:hover { border-color: #b8d9ee; background: #F0F7FF; }
  .cvp-tab:hover .cvp-tab-name  { color: #38aae1; }
  .cvp-tab:hover .cvp-tab-dates { color: #b8d9ee; }
  .cvp-tab.active {
    border-color: #25476a;
    background: linear-gradient(135deg, #25476a, #2e7db5);
    box-shadow: 0 2px 10px rgba(37,71,106,0.25);
  }
  .cvp-tab.active .cvp-tab-name  { color: #fff; }
  .cvp-tab.active .cvp-tab-dates { color: rgba(255,255,255,0.65); }

  /* Date pills row shown below tabs */
  .cvp-date-pills {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    padding: 10px 20px;
    border-bottom: 1px solid #F3F4F6;
    animation: cvp-fade 0.15s ease;
  }
  .cvp-date-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    font-family: Inter, sans-serif;
  }
  .cvp-date-pill-term {
    background: #e8f5fb;
    color: #25476a;
    border: 1.5px solid #a8d5ee;
  }
  .cvp-date-pill-break {
    background: #FFF7ED;
    color: #C2410C;
    border: 1.5px solid #FED7AA;
  }
  .cvp-date-pill-none {
    background: #F9FAFB;
    color: #9CA3AF;
    border: 1.5px dashed #E5E7EB;
    font-weight: 500;
    font-style: italic;
  }

  /* Class/course rows */
  .cvp-class-list {
    max-height: 260px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #d6edf8 transparent;
  }
  .cvp-class-list::-webkit-scrollbar { width: 4px; }
  .cvp-class-list::-webkit-scrollbar-thumb { background: #a8d5ee; border-radius: 4px; }
  .cvp-class-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 20px;
    border-bottom: 1px solid #F9FAFB;
  }
  .cvp-class-row:last-child { border-bottom: none; }
  .cvp-class-row:hover { background: #FAFBFF; }
  .cvp-class-name {
    min-width: 100px;
    flex-shrink: 0;
    font-size: 12px;
    font-weight: 700;
    color: #374151;
  }
  .cvp-chips { display: flex; flex-wrap: wrap; gap: 5px; flex: 1; }
  .cvp-chip {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 3px 9px; border-radius: 20px;
    font-size: 11px; font-weight: 500; white-space: nowrap;
  }
  .cvp-chip-code {
    font-size: 9px; font-weight: 700; opacity: 0.7;
    padding: 1px 5px; border-radius: 10px; background: rgba(0,0,0,0.08);
  }
  .cvp-no-courses { font-size: 11px; color: #9CA3AF; font-style: italic; }
  .cvp-period-content { animation: cvp-fade 0.2s ease; }

  @media (max-width: 640px) {
    .cvp-class-row { flex-direction: column; gap: 8px; }
    .cvp-class-name { min-width: unset; }
    .cvp-date-card-body { flex-direction: column; }
    .cvp-date-box { min-width: unset; width: 100%; }
  }

  /* In-page section nav — quick-jump, not sticky: MainLayout's shell scrolls the page via
     an ancestor with overflow:hidden between this content and the real scroll container, which
     breaks position:sticky's containing-block chain. Fixing that would mean changing shared
     layout CSS every other page also depends on, so this stays a plain jump bar instead of a
     pinned one. Styled as real underlined tabs (not pill buttons) with an active state driven by
     scroll-spy (see SectionNav's IntersectionObserver), so it reads as "which section am I in"
     rather than a row of disconnected shortcuts. */
  .cvp-section-nav {
    z-index: 15;
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    padding: 0 4px;
    margin-bottom: 20px;
    background: transparent;
    border-bottom: 1.5px solid #E5E7EB;
  }
  .cvp-section-nav-link {
    position: relative;
    padding: 11px 15px;
    font-size: 12.5px;
    font-weight: 600;
    font-family: Inter, sans-serif;
    color: #6B7280;
    background: transparent;
    border: none;
    cursor: pointer;
    white-space: nowrap;
    transition: color 0.15s;
  }
  .cvp-section-nav-link:hover { color: #25476a; }
  .cvp-section-nav-link.active { color: #25476a; font-weight: 700; }
  .cvp-section-nav-link::after {
    content: "";
    position: absolute;
    left: 10px; right: 10px; bottom: -1.5px;
    height: 2.5px;
    border-radius: 2px 2px 0 0;
    background: linear-gradient(90deg, #25476a, #38aae1);
    transform: scaleX(0);
    transition: transform 0.18s ease;
  }
  .cvp-section-nav-link.active::after { transform: scaleX(1); }

  /* Grade / structure pills */
  .cvp-grade-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border-radius: 12px;
    border: 1px solid #E5E7EB;
    background: #FAFBFF;
  }
  .cvp-grade-seq {
    display: inline-flex; align-items: center; justify-content: center;
    width: 26px; height: 26px; border-radius: 8px; flex-shrink: 0;
    background: #e8f5fb; color: #25476a; border: 1px solid #a8d5ee;
    font-size: 11px; font-weight: 800;
  }

  @media (max-width: 640px) {
    .cvp-section-nav { overflow-x: auto; flex-wrap: nowrap; }
  }
`;

// Grade classes have no explicit order field — a System Level's own `sequence` is the only
// real ordering signal (same resolution CurriculumLevelMappingTable.jsx uses), falling back to
// array order for any class whose systemLevelId doesn't resolve (unmapped or level deleted).
function sortClassesBySystemLevel(classes, systemLevels) {
  const sequenceById = new Map((systemLevels || []).map((l) => [l.id, l.sequence]));
  return [...(classes || [])].sort((a, b) => {
    const sa = sequenceById.get(a.systemLevelId);
    const sb = sequenceById.get(b.systemLevelId);
    if (sa == null && sb == null) return 0;
    if (sa == null) return 1;
    if (sb == null) return -1;
    return sa - sb;
  });
}

// Every (periodName, className) a course currently appears under, across the live version's
// content — feeds the "where is this course actually assigned" tag in Attached Courses, so that
// section and Course Assignments read as one picture instead of two disconnected lists.
function buildCourseAssignmentIndex(content) {
  const byCourseId = new Map();
  (content || []).forEach((period) => {
    (period.classes || []).forEach((cls) => {
      (cls.courses || []).forEach((course) => {
        const list = byCourseId.get(course.id) || [];
        list.push({ periodName: period.periodName, className: cls.className });
        byCourseId.set(course.id, list);
      });
    });
  });
  return byCourseId;
}

// Scroll-spy'd tab strip, not just a jump bar — tracks which section currently sits at the top
// of the viewport (via IntersectionObserver, since position:sticky can't be used here — see the
// CSS comment above) so the active underline follows the reader's scroll position, not only a
// click. rootMargin's -70% bottom keeps a section "active" only while it's in the upper third of
// the viewport, matching each section's own scrollMarginTop: 76px.
function SectionNav({ links }) {
  const [active, setActive] = useState(links[0]?.id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 },
    );
    const els = links.map((l) => document.getElementById(l.id)).filter(Boolean);
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [links]);

  const scrollTo = (id) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <nav className="cvp-section-nav" aria-label="Jump to section">
      {links.map((l) => (
        <button key={l.id} type="button" className={`cvp-section-nav-link${active === l.id ? " active" : ""}`} onClick={() => scrollTo(l.id)}>
          {l.label}
        </button>
      ))}
    </nav>
  );
}

// First-class "what does this curriculum actually span" section — grade list (sorted by System
// Level sequence) plus the academic cycle model and period names. Previously this was only
// inferable indirectly through Course Assignments, and only once a version existed.
function StructureSection({ curriculumId, classes, periods, model, systemLevels, navigate }) {
  const sortedClasses = sortClassesBySystemLevel(classes, systemLevels);
  const sequenceById = new Map((systemLevels || []).map((l) => [l.id, l.sequence]));

  return (
    <div id="structure" style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", overflow: "hidden", marginBottom: "20px", scrollMarginTop: "76px" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827" }}>Structure</h2>
          <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#9CA3AF" }}>Grades this curriculum spans and its academic cycle</p>
        </div>
        <ManageLink onClick={() => navigate(`/curriculum/${curriculumId}/structure`)} />
      </div>

      {sortedClasses.length === 0 ? (
        <div style={{ padding: "32px 24px", textAlign: "center" }}>
          <div style={{ fontSize: "28px", color: "#9CA3AF", display: "flex", justifyContent: "center", marginBottom: "8px" }}><AccountTreeIcon fontSize="inherit" /></div>
          <p style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: "700", color: "#374151" }}>No grades configured yet</p>
          <p style={{ margin: "0 0 16px", fontSize: "12.5px", color: "#9CA3AF", maxWidth: "360px", marginInline: "auto", lineHeight: "1.6" }}>
            Choose which grade levels this curriculum spans and label each one.
          </p>
          <button type="button" onClick={() => navigate(`/curriculum/${curriculumId}/structure`)}
            style={{ padding: "9px 20px", backgroundColor: "#25476a", color: "#fff", border: "none", borderRadius: "9px", fontSize: "13px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            Configure Structure →
          </button>
        </div>
      ) : (
        <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "20px", alignItems: "start" }}>
          <div>
            <p style={{ margin: "0 0 10px", fontSize: "10px", fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.07em" }}>
              Grades · {sortedClasses.length}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {sortedClasses.map((cls) => (
                <div key={cls.id} className="cvp-grade-row">
                  <span className="cvp-grade-seq">{sequenceById.get(cls.systemLevelId) ?? "?"}</span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "#111827" }}>{cls.name}</p>
                    {cls.shortLabel && <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF" }}>{cls.shortLabel}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p style={{ margin: "0 0 10px", fontSize: "10px", fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.07em" }}>
              Academic Cycle
            </p>
            <div style={{ padding: "12px 14px", borderRadius: "12px", border: "1px solid #E5E7EB", backgroundColor: "#FAFBFF", marginBottom: "10px" }}>
              <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "#25476a" }}>{cycleLabel(model)}</p>
            </div>
            {periods.length === 0 ? (
              <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF", fontStyle: "italic" }}>No {cycleLabel(model).toLowerCase()} named yet</p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {periods.map((p, i) => (
                  <span key={p.id || i} style={{ padding: "4px 12px", borderRadius: "20px", fontSize: "11.5px", fontWeight: "600", backgroundColor: "#e8f5fb", color: "#25476a", border: "1px solid #a8d5ee" }}>
                    {p.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Small atoms ─────────────────────────────────────────────────────── */

// Ghost text-link, not a bordered pill button — every section header used to repeat its own
// "Manage →" button styled identically to a primary action, which flattened the page into a wall
// of same-weight buttons. This is deliberately lower-emphasis (no border/fill) so a section's
// real content reads first and "Manage" reads as a secondary way in, not a competing CTA.
function ManageLink({ onClick, children = "Manage" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: "4px", padding: "6px 2px",
        background: "none", border: "none", color: "#25476a", fontSize: "12.5px", fontWeight: "700",
        fontFamily: "Inter, sans-serif", cursor: "pointer", flexShrink: 0,
      }}
    >
      {children} <ArrowForwardIcon sx={{ fontSize: 14 }} />
    </button>
  );
}

// Overflow menu for secondary header actions — collapses what used to be a row of 3-4 identical
// buttons into one trigger, so the hero header reads as "one primary action + a menu" instead of
// a wall of buttons all fighting for the same attention.
function HeaderMenu({ items }) {
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
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="More actions"
        aria-expanded={open}
        style={{
          width: "34px", height: "34px", display: "inline-flex", alignItems: "center", justifyContent: "center",
          backgroundColor: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)",
          borderRadius: "8px", cursor: "pointer",
        }}
      >
        <MoreVertIcon fontSize="small" />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 30,
          background: "#fff", border: "1px solid #E5E7EB", borderRadius: "12px",
          boxShadow: "0 10px 28px rgba(15,38,69,0.14), 0 2px 8px rgba(0,0,0,0.06)",
          minWidth: "200px", overflow: "hidden", padding: "6px",
        }}>
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              onClick={() => { it.onClick(); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: "9px", width: "100%", padding: "9px 10px",
                border: "none", borderRadius: "8px", background: "transparent",
                fontSize: "12.5px", fontWeight: "600", fontFamily: "Inter, sans-serif", color: "#374151",
                textAlign: "left", cursor: "pointer", boxSizing: "border-box",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#F3F4F6"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ display: "flex", color: "#25476a", flexShrink: 0 }}>{it.icon}</span>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ course, index }) {
  const shade = COURSE_SHADES[index % COURSE_SHADES.length];
  return (
    <span className="cvp-chip" style={{ backgroundColor: shade.bg, color: shade.color, border: `1px solid ${shade.border}` }}>
      {course.name}
      {course.code && <span className="cvp-chip-code">{course.code}</span>}
    </span>
  );
}

/* ── Competency Framework summary (Competencies wizard step) ──────────── */

function FrameworkTag({ label, sub, color = "#25476a", bg = "#e8f5fb", border = "#a8d5ee" }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px", maxWidth: "100%",
      padding: "4px 10px", borderRadius: "20px", fontSize: "11.5px", fontWeight: "600",
      backgroundColor: bg, color, border: `1px solid ${border}`,
    }} title={sub != null ? `${label} ${sub}` : label}>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "150px" }}>{label}</span>
      {sub != null && <span style={{ opacity: 0.65, fontWeight: "700", flexShrink: 0, whiteSpace: "nowrap" }}>{sub}</span>}
    </span>
  );
}

function FrameworkPanel({ icon, title, count, emptyText, children }) {
  return (
    <div style={{ padding: "14px 16px", backgroundColor: "#FAFBFF", border: "1px solid #F0F2F5", borderRadius: "14px", display: "flex", flexDirection: "column", gap: "10px", minHeight: "120px", minWidth: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ display: "flex", color: "#25476a" }}>{icon}</span>
        <span style={{ fontSize: "12.5px", fontWeight: "700", color: "#111827", flex: 1 }}>{title}</span>
        <span style={{ padding: "1px 8px", borderRadius: "20px", fontSize: "10.5px", fontWeight: "700", backgroundColor: "#F3F4F6", color: "#6B7280" }}>{count}</span>
      </div>
      {count === 0 ? (
        <p style={{ margin: 0, fontSize: "11.5px", color: "#D1D5DB", fontStyle: "italic" }}>{emptyText}</p>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", minWidth: 0 }}>{children}</div>
      )}
    </div>
  );
}


/* ── Add-course dropdown (courses are created in the Courses module, not here) ── */

function AddCourseDropdown({ available, onAdd }) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState("");
  const ref      = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
    else setQuery("");
  }, [open]);

  const trimmed  = query.trim();
  const filtered = trimmed
    ? available.filter((c) => c.name.toLowerCase().includes(trimmed.toLowerCase()))
    : available;

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px",
          backgroundColor: "#e8f5fb", color: "#25476a", border: "1.5px solid #a8d5ee",
          borderRadius: "9px", fontSize: "13px", fontWeight: "600", fontFamily: "Inter, sans-serif",
          cursor: "pointer",
        }}
      >
        + Add Course
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 20,
          background: "#fff", border: "1px solid #E5E7EB", borderRadius: "12px",
          boxShadow: "0 10px 28px rgba(15,38,69,0.14), 0 2px 8px rgba(0,0,0,0.06)",
          width: "280px", maxHeight: "320px", overflow: "hidden", display: "flex", flexDirection: "column",
        }}>
          <div style={{ position: "relative", flexShrink: 0, borderBottom: "1px solid #F0F2F5" }}>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search courses…"
              style={{
                width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "none",
                fontSize: "13px", fontFamily: "Inter, sans-serif", outline: "none", color: "#111827", background: "#fff",
              }}
            />
          </div>
          <div style={{ overflowY: "auto", padding: "6px" }}>
            {filtered.length === 0 && (
              <div style={{ padding: "22px 12px", textAlign: "center" }}>
                <div style={{ fontSize: "22px", marginBottom: "4px" }}>{available.length === 0 ? <CheckCircleOutlineIcon fontSize="medium" /> : <SearchIcon fontSize="medium" />}</div>
                <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF" }}>
                  {available.length === 0 ? "Every course is already added." : "No matches found."}
                </p>
              </div>
            )}
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { onAdd(c.id); setOpen(false); }}
                style={{
                  display: "block", width: "100%", padding: "8px 10px", border: "none", borderRadius: "8px",
                  background: "transparent", fontSize: "12.5px", fontWeight: "600", fontFamily: "Inter, sans-serif",
                  color: "#374151", textAlign: "left", cursor: "pointer",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#F3F4F6"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Loading state ────────────────────────────────────────────────────── */

function LoadingState() {
  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{`@keyframes cvp-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "400px", gap: "14px", color: "#6B7280", fontSize: "14px" }}>
        <span style={{ width: "28px", height: "28px", border: "3px solid #E5E7EB", borderTopColor: "#25476a", borderRadius: "50%", display: "inline-block", animation: "cvp-spin 0.7s linear infinite" }} />
        Loading curriculum…
      </div>
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────────────── */

export default function CurriculumViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: curriculum, isLoading: currLoading, isError } = useCurriculumQuery(id);
  const { data: vData, isLoading: vLoading } = useCurriculumVersions(id);
  const { data: yearData } = useAcademicYears(id);
  const { data: systemLevels = [] } = useSystemLevels();

  // Competency Framework (built in the Competencies wizard step) — fetched independently
  // so it never blocks the page's initial paint; each panel below just shows "0" until ready.
  const { data: fwCompetencies = [] }  = useCompetencies(id);
  const { data: fwPathways = [] } = usePathways(id);
  const { data: fwAgeCategories = [] } = useAgeCategories(id);
  const { data: fwProgressLevels = [] } = useProgressLevels(id);
  const { data: fwAssessmentTypes = [] } = useAssessmentTypes(id);
  const { data: fwEvidenceTypes = [] }   = useEvidenceTypes(id);
  const { data: fwPerformanceBandsRaw = [] } = usePerformanceBands(id);
  // Bands with a pathwayId are repurposed as a Pathway's course-sequence rung for
  // Pathway placement, not a real curriculum-wide Progress Arc band — the server's
  // own scoring engine excludes them the same way (competency.service.js calculateScore/
  // calculateIndicatorProgress), so the summary below does too.
  const fwPerformanceBands = fwPerformanceBandsRaw.filter((b) => !b.pathwayId);

  const { data: schoolsData } = useQuery({
    queryKey: ["schools", "byCurriculum", id],
    queryFn:  () => schoolApi.getAll({ curriculumId: id }),
    enabled:  !!id,
  });

  // Courses attached to this curriculum — a course stays independent and reusable
  // elsewhere, this just records which ones are currently used by this curriculum.
  const { data: attachedCourses = [] } = useCurriculumCourses(id);
  const { data: allCoursesData }       = useCoursesQuery();
  const allCourses = allCoursesData?.data || [];
  const { mutate: linkCourse }   = useLinkCourse(id);
  const { mutate: unlinkCourse } = useUnlinkCourse(id);

  // A program curriculum can be deployed to more than one hub (or redeployed for a different
  // run) — each deployment is its own Program record. Only relevant once isProgram is known,
  // but the hook itself has to run unconditionally (rules of hooks), same as every query above.
  const { data: deployments } = useProgramsByCurriculumQuery(id);

  const [activePeriod, setActivePeriod] = useState(0);

  if (currLoading || vLoading) return <LoadingState />;

  if (isError || !curriculum) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "20px 24px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "14px" }}>
          <WarningAmberIcon sx={{ fontSize: 24, color: "#DC2626" }} />
          <div>
            <p style={{ margin: "0 0 4px 0", fontWeight: "700", color: "#DC2626", fontSize: "14px" }}>Could not load curriculum</p>
            <p style={{ margin: 0, fontSize: "13px", color: "#EF4444" }}>The curriculum may not exist or there was a network error.</p>
          </div>
        </div>
      </div>
    );
  }

  const assignedSchools  = schoolsData?.data || [];
  const current          = vData?.current;
  const history          = vData?.history || [];
  const content          = current?.content || [];
  const periods          = curriculum.periods || [];
  const classes          = curriculum.classes || [];
  const model            = curriculum.academicCycleModel || "terms";
  const curriculumType   = curriculum.curriculumType || null;

  // Resolve published academic year from new two-level API (groups → versions)
  const publishedAYVersion = yearData?.publishedVersion || null;
  const publishedAYGroup   = publishedAYVersion
    ? (yearData?.groups || []).find((g) => g.versions?.some((v) => v.id === publishedAYVersion.id)) || null
    : null;
  const activeYearLabel    = publishedAYGroup?.label || curriculum.academicYear || null;
  const activeYearPeriods  = publishedAYVersion?.periods || [];

  /* Stats derived from version content */
  const totalCourses = content.reduce(
    (s, p) => s + (p.classes || []).reduce((cs, cls) => cs + (cls.courses?.length || 0), 0),
    0,
  );

  /* Active period content */
  const safeIdx          = Math.min(activePeriod, Math.max(content.length - 1, 0));
  const activePeriodData = content[safeIdx];

  /* Academic-year period tabs (used when no version exists yet) */
  const yearPeriods  = activeYearPeriods;
  const yearSafeIdx  = Math.min(activePeriod, Math.max(yearPeriods.length - 1, 0));

  /* Every group/version the Academic Year system has ever recorded, flattened — feeds the
     Version Control section's own status card so it never needs a separate page visit to know
     "is the calendar itself live". */
  const ayGroups   = yearData?.groups || [];
  const ayVersions = ayGroups.flatMap((g) => (g.versions || []).map((v) => ({ ...v, groupLabel: g.label })));
  const ayHasDraft = ayVersions.some((v) => v.status === "draft");

  /* Where each attached course currently sits in the live version's content — cross-links
     Attached Courses with Course Assignments instead of leaving them as two disconnected lists. */
  const courseAssignmentIndex = buildCourseAssignmentIndex(content);

  const sectionLinks = [
    { id: "structure", label: "Structure" },
    { id: "course-assignments", label: "Course Assignments" },
    { id: "competencies", label: "Competencies" },
    { id: "version-control", label: "Version Control" },
    { id: "courses", label: "Courses" },
    { id: "hubs", label: "Hubs" },
  ];

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{CSS}</style>

      {/* ── Breadcrumb / back ─────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
        <button
          type="button"
          onClick={() => navigate(curriculum.isProgram ? "/programs" : "/curriculum")}
          style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            padding: "7px 14px", backgroundColor: "#ffffff", color: "#374151",
            border: "1.5px solid #E5E7EB", borderRadius: "9px",
            fontSize: "13px", fontWeight: "500", fontFamily: "Inter, sans-serif", cursor: "pointer",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {curriculum.isProgram ? "All Programs" : "All Curricula"}
        </button>
        <span style={{ color: "#D1D5DB", fontSize: "13px" }}>/</span>
        <span style={{ fontSize: "13px", color: "#6B7280", maxWidth: "220px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {curriculum.name}
        </span>
      </div>

      {/* ── Hero header card ──────────────────────────────────────────── */}
      <div style={{
        backgroundColor: "#ffffff", borderRadius: "20px",
        boxShadow: "0 4px 20px rgba(37,71,106,0.10), 0 1px 4px rgba(0,0,0,0.05)",
        overflow: "hidden", marginBottom: "20px",
      }}>
        {/* Gradient banner */}
        <div style={{
          background: "linear-gradient(135deg, #0A3880 0%, #25476a 40%, #2e7db5 70%, #38aae1 100%)",
          padding: "24px 28px 28px", position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: "-30px", right: "-30px", width: "160px", height: "160px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)" }} />
          <div style={{ position: "absolute", bottom: "-10px", right: "100px", width: "80px", height: "80px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.06)" }} />

          {/* Top row: framework + type badges + action buttons */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "14px", position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={{
                padding: "4px 13px", borderRadius: "20px",
                backgroundColor: "rgba(255,255,255,0.18)", color: "#ffffff",
                border: "1px solid rgba(255,255,255,0.25)",
                fontSize: "11px", fontWeight: "700", letterSpacing: "0.04em",
              }}>
                {curriculum.framework || "No Framework"}
              </span>
              {curriculumType && (
                <span style={{
                  padding: "4px 13px", borderRadius: "20px",
                  backgroundColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.95)",
                  border: "1px solid rgba(255,255,255,0.20)",
                  fontSize: "11px", fontWeight: "600", letterSpacing: "0.03em",
                }}>
                  {curriculumType}
                </span>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
              <HeaderMenu
                items={[
                  { label: "Edit Details", icon: <EditIcon fontSize="small" />, onClick: () => navigate(`/curriculum/${id}/edit`) },
                  { label: "Structure", icon: <AccountTreeIcon fontSize="small" />, onClick: () => navigate(`/curriculum/${id}/structure`) },
                  ...(!curriculum.isProgram
                    ? [{ label: "Academic Year", icon: <CalendarMonthIcon fontSize="small" />, onClick: () => navigate(`/curriculum/${id}/academic-year`) }]
                    : []),
                ]}
              />
              <button type="button" onClick={() => navigate(`/curriculum/${id}/versions`)}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px", backgroundColor: "rgba(255,255,255,0.95)", color: "#25476a", border: "none", borderRadius: "8px", fontSize: "12.5px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
                <FolderCopyIcon fontSize="small" /> Version Control
              </button>
            </div>
          </div>

          {/* Name */}
          <h1 style={{ margin: "0 0 4px 0", fontSize: "24px", fontWeight: "900", color: "#ffffff", letterSpacing: "-0.4px", lineHeight: 1.2, position: "relative" }}>
            {curriculum.name}
          </h1>
          <p style={{ margin: "0 0 8px 0", fontSize: "13px", color: "rgba(255,255,255,0.72)", fontWeight: "500", position: "relative" }}>
            {[curriculum.code, curriculum.academicYear, cycleLabel(model)].filter(Boolean).join("  ·  ")}
          </p>
          {curriculum.description && (
            <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.72)", lineHeight: "1.6", maxWidth: "560px", position: "relative", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {curriculum.description}
            </p>
          )}
        </div>

        {/* Stats bar */}
        <div style={{ padding: "18px 28px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {[
            { label: cycleLabel(model), value: periods.length, icon: <CalendarMonthIcon fontSize="small" />, bg: "#e8f5fb", color: "#38aae1", border: "#a8d5ee" },
            { label: "Classes",         value: classes.length,  icon: <SchoolIcon fontSize="small" />, bg: "#d6edf8", color: "#2e7db5", border: "#b8d9ee" },
            { label: "Total Courses",   value: totalCourses,    icon: <MenuBookIcon fontSize="small" />, bg: "#E0F2FE", color: "#38aae1", border: "#a8d5ee" },
            { label: "Versions",        value: history.length + (current ? 1 : 0), icon: <FolderCopyIcon fontSize="small" />, bg: "#F0F7FF", color: "#25476a", border: "#C7D9F8" },
          ].map((stat) => (
            <div key={stat.label} style={{
              display: "flex", alignItems: "center", gap: "10px",
              padding: "11px 16px", backgroundColor: stat.bg, border: `1px solid ${stat.border}`,
              borderRadius: "12px", flex: "1 0 100px", minWidth: "90px",
            }}>
              <span style={{ display: "flex", color: stat.color, flexShrink: 0 }}>{stat.icon}</span>
              <div>
                <p style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: stat.color, lineHeight: 1 }}>{stat.value}</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "10px", fontWeight: "700", color: stat.color, opacity: 0.65, textTransform: "uppercase", letterSpacing: "0.06em" }}>{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <SectionNav links={sectionLinks} />

      <StructureSection
        curriculumId={id}
        classes={classes}
        periods={periods}
        model={model}
        systemLevels={systemLevels}
        navigate={navigate}
      />

      {/* ── Deployments (Programs only) ──────────────────────────────────── */}
      {curriculum.isProgram && (
        <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "16px 20px", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
            <div>
              <h2 style={{ margin: "0 0 2px", fontSize: "14px", fontWeight: "700", color: "#111827" }}>Deployments</h2>
              <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF" }}>Every hub this program has been deployed to — deploy it to another anytime.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/programs/create?curriculumId=${id}`)}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px", backgroundColor: "#25476a", color: "#ffffff", border: "none", borderRadius: "8px", fontSize: "12.5px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}
            >
              + Deploy to Hub
            </button>
          </div>

          {!deployments?.length ? (
            <p style={{ margin: "14px 0 4px", fontSize: "13px", color: "#9CA3AF" }}>Not deployed to any hub yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "14px" }}>
              {deployments.map((d) => {
                const dsc = DEPLOYMENT_STATUS[d.status] || DEPLOYMENT_STATUS.upcoming;
                return (
                  <div
                    key={d.id}
                    onClick={() => navigate(`/programs/${d.id}/view`)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: "10px", border: "1px solid #E5E7EB", cursor: "pointer", transition: "background-color 0.12s" }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#F9FAFB"}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                  >
                    <div>
                      <p style={{ margin: 0, fontSize: "13.5px", fontWeight: "600", color: "#111827" }}>{d.hubName}</p>
                      <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
                        {fmtDate(d.startDate)} → {fmtDate(d.endDate)} · {d.learnerCount} learner{d.learnerCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <span style={{ padding: "2px 9px", borderRadius: "20px", fontSize: "10.5px", fontWeight: "700", backgroundColor: dsc.bg, color: dsc.color, border: `1px solid ${dsc.border}`, whiteSpace: "nowrap" }}>
                      {dsc.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Course Assignments Section ───────────────────────────────────── */}
      <div id="course-assignments" style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", overflow: "hidden", marginBottom: "20px", scrollMarginTop: "76px" }}>

        {/* Section header */}
        <div style={{ padding: "16px 20px 0", borderBottom: "1px solid #F3F4F6" }}>
          <h2 style={{ margin: "0 0 2px", fontSize: "14px", fontWeight: "700", color: "#111827" }}>Course Assignments</h2>
          <p style={{ margin: "0 0 14px", fontSize: "11px", color: "#9CA3AF" }}>
            {current ? "Courses assigned per class — select a period to see dates" : "No version created yet"}
          </p>
          {/* Metadata row — labeled stat columns */}
          {(activeYearLabel || current) && (() => {
            const sc = current ? (STATUS_CONFIG[current.status] || STATUS_CONFIG.inactive) : null;
            return (
              <div style={{ display: "flex", gap: "0", borderTop: "1px solid #F3F4F6", marginInline: "-20px" }}>
                {activeYearLabel && (
                  <div style={{ flex: "1 1 auto", padding: "10px 20px", borderRight: "1px solid #F3F4F6" }}>
                    <div style={{ fontSize: "10px", fontWeight: "600", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "4px" }}>Academic Year</div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38aae1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                      <span style={{ fontSize: "13px", fontWeight: "700", color: "#111827" }}>{activeYearLabel}</span>
                    </div>
                  </div>
                )}
                {current && (
                  <div style={{ padding: "10px 20px", borderRight: "1px solid #F3F4F6", flexShrink: 0 }}>
                    <div style={{ fontSize: "10px", fontWeight: "600", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "4px" }}>Version</div>
                    <span style={{ fontSize: "13px", fontWeight: "700", color: "#25476a" }}>v{current.versionNumber}</span>
                  </div>
                )}
                {current && sc && (
                  <div style={{ padding: "10px 20px", flexShrink: 0 }}>
                    <div style={{ fontSize: "10px", fontWeight: "600", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "4px" }}>Status</div>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "3px 10px", borderRadius: "20px", backgroundColor: sc.bg, color: sc.color, border: `1.5px solid ${sc.border}`, fontSize: "12px", fontWeight: "700" }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: sc.dot, flexShrink: 0 }} />
                      {sc.label}
                    </span>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {!current ? (
          yearPeriods.length > 0 ? (
            /* ── Academic year periods visible but no course version yet ── */
            <>
              <div className="cvp-period-tabs">
                {yearPeriods.map((p, i) => {
                  const hasDate = p.startDate || p.endDate;
                  const shortDate = hasDate
                    ? `${new Date(p.startDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} – ${new Date(p.endDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`
                    : null;
                  return (
                    <button key={i} type="button" className={`cvp-tab${yearSafeIdx === i ? " active" : ""}`} onClick={() => setActivePeriod(i)}>
                      <span className="cvp-tab-name">{p.name}</span>
                      {shortDate && <span className="cvp-tab-dates">{shortDate}</span>}
                    </button>
                  );
                })}
              </div>

              {/* Date pills for selected period */}
              {(() => {
                const sel = yearPeriods[yearSafeIdx];
                if (!sel) return null;
                const hasDates = sel.startDate || sel.endDate;
                const hasBreak = sel.breakStartDate || sel.breakEndDate;
                return (
                  <div className="cvp-date-pills">
                    {hasDates ? (
                      <span className="cvp-date-pill cvp-date-pill-term">
                        <CalendarMonthIcon fontSize="inherit" style={{ verticalAlign: "-2px", marginRight: 4 }} /> {fmtDate(sel.startDate)} → {fmtDate(sel.endDate)}
                      </span>
                    ) : (
                      <span className="cvp-date-pill cvp-date-pill-none">No dates set — configure in Academic Year</span>
                    )}
                    {hasBreak && (
                      <span className="cvp-date-pill cvp-date-pill-break">
                        <><CoffeeIcon fontSize="small" /> Break: {fmtDate(sel.breakStartDate)} → {fmtDate(sel.breakEndDate)}</>
                      </span>
                    )}
                  </div>
                );
              })()}

              <div style={{ padding: "16px 20px" }}>
                <div style={{ padding: "20px", textAlign: "center", backgroundColor: "#FAFAFA", borderRadius: "12px", border: "1.5px dashed #E5E7EB" }}>
                  <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#6B7280", lineHeight: "1.5" }}>
                    No course assignments yet. Go to Version Control to assign courses to each class per term.
                  </p>
                  <button type="button" onClick={() => navigate(`/curriculum/${id}/versions`)}
                    style={{ padding: "9px 20px", backgroundColor: "#25476a", color: "#fff", border: "none", borderRadius: "9px", fontSize: "13px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
                    Open Version Control →
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* No academic year configured */
            <div style={{ padding: "48px 24px", textAlign: "center" }}>
              <div style={{ width: "64px", height: "64px", borderRadius: "16px", background: "linear-gradient(135deg, #e8f5fb, #d6edf8)", border: "2px solid #a8d5ee", color: "#25476a", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}><FolderCopyIcon fontSize="large" /></div>
              <h3 style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: "700", color: "#111827" }}>No Version Created Yet</h3>
              <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#6B7280", lineHeight: "1.6", maxWidth: "340px", marginInline: "auto" }}>
                Go to Version Control to assign courses to each class per period, then save as a version.
              </p>
              <button type="button" onClick={() => navigate(`/curriculum/${id}/versions`)}
                style={{ padding: "10px 22px", backgroundColor: "#25476a", color: "#fff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
                Open Version Control →
              </button>
            </div>
          )
        ) : content.length === 0 ? (
          <div style={{ padding: "32px 24px", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>This version has no period content yet.</p>
          </div>
        ) : (
          <>
            {/* Period tabs — show date hint under each tab name */}
            <div className="cvp-period-tabs">
              {content.map((p, i) => {
                const pDates  = resolvePeriodDates(p.periodName, { periods: activeYearPeriods }, periods);
                const hasDate = pDates?.startDate || pDates?.endDate;
                const shortDate = hasDate
                  ? `${new Date(pDates.startDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} – ${new Date(pDates.endDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`
                  : null;
                return (
                  <button key={i} type="button" className={`cvp-tab${safeIdx === i ? " active" : ""}`} onClick={() => setActivePeriod(i)}>
                    <span className="cvp-tab-name">{p.periodName}</span>
                    {shortDate && <span className="cvp-tab-dates">{shortDate}</span>}
                  </button>
                );
              })}
            </div>

            {/* Date pills for the active period */}
            {activePeriodData && (() => {
              const pDates  = resolvePeriodDates(activePeriodData.periodName, { periods: activeYearPeriods }, periods);
              const hasDates = pDates?.startDate || pDates?.endDate;
              const hasBreak = pDates?.breakStartDate || pDates?.breakEndDate;
              return (
                <div className="cvp-date-pills">
                  {hasDates ? (
                    <span className="cvp-date-pill cvp-date-pill-term">
                      <CalendarMonthIcon fontSize="inherit" style={{ verticalAlign: "-2px", marginRight: 4 }} /> {fmtDate(pDates.startDate)} → {fmtDate(pDates.endDate)}
                    </span>
                  ) : (
                    <span className="cvp-date-pill cvp-date-pill-none">No dates — set in Academic Year → Period Dates</span>
                  )}
                  {hasBreak && (
                    <span className="cvp-date-pill cvp-date-pill-break">
                      <><CoffeeIcon fontSize="small" /> Break: {fmtDate(pDates.breakStartDate)} → {fmtDate(pDates.breakEndDate)}</>
                    </span>
                  )}
                </div>
              );
            })()}

            {/* Class / course content */}
            {activePeriodData && (
              <div className="cvp-period-content">
                {(activePeriodData.classes || []).length === 0 ? (
                  <div style={{ padding: "24px", textAlign: "center" }}>
                    <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>No classes for this period.</p>
                  </div>
                ) : (
                  <>
                    {/* column headers */}
                    <div style={{ display: "flex", gap: "10px", padding: "6px 20px", backgroundColor: "#F9FAFB", borderBottom: "1px solid #F3F4F6" }}>
                      <span style={{ minWidth: "100px", flexShrink: 0, fontSize: "10px", fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>Class</span>
                      <span style={{ fontSize: "10px", fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>Courses</span>
                    </div>
                    <div className="cvp-class-list">
                      {(activePeriodData.classes || []).map((cls) => (
                        <div key={cls.classId || cls.className} className="cvp-class-row">
                          <span className="cvp-class-name">{cls.className}</span>
                          <div className="cvp-chips">
                            {(cls.courses || []).length === 0 ? (
                              <span className="cvp-no-courses">No courses assigned</span>
                            ) : (
                              (cls.courses || []).map((course, ci) => (
                                <Chip key={course.id} course={course} index={ci} />
                              ))
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {(activePeriodData.classes || []).length > 4 && (
                      <div style={{ padding: "6px 20px", borderTop: "1px solid #F3F4F6", textAlign: "right" }}>
                        <span style={{ fontSize: "10px", color: "#9CA3AF" }}>
                          {activePeriodData.classes.length} classes · scroll to see all
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Competency Framework ─────────────────────────────────────────── */}
      <div id="competencies" style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", overflow: "hidden", marginBottom: "20px", scrollMarginTop: "76px" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827" }}>Competency Framework</h2>
            <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#9CA3AF" }}>Competencies, pathways, progress arc, and assessment design for this curriculum</p>
          </div>
          <ManageLink onClick={() => navigate(`/curriculum/${id}/competencies`)} />
        </div>

        {fwCompetencies.length === 0 && fwPathways.length === 0 && fwPerformanceBands.length === 0 && fwProgressLevels.length === 0 && fwAssessmentTypes.length === 0 ? (
          <div style={{ padding: "32px 24px", textAlign: "center" }}>
            <div style={{ fontSize: "28px", color: "#9CA3AF", display: "flex", justifyContent: "center", marginBottom: "8px" }}><TrackChangesIcon fontSize="inherit" /></div>
            <p style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: "700", color: "#374151" }}>No competency framework set up yet</p>
            <p style={{ margin: "0 0 16px", fontSize: "12.5px", color: "#9CA3AF", maxWidth: "360px", marginInline: "auto", lineHeight: "1.6" }}>
              Adopt competencies, group them into pathways, build the progress arc, and design assessments for this curriculum.
            </p>
            <button type="button" onClick={() => navigate(`/curriculum/${id}/competencies`)}
              style={{ padding: "9px 20px", backgroundColor: "#25476a", color: "#fff", border: "none", borderRadius: "9px", fontSize: "13px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
              Set Up Competency Framework →
            </button>
          </div>
        ) : (
          <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
            <FrameworkPanel icon={<TrackChangesIcon fontSize="small" />} title="Competencies" count={fwCompetencies.length} emptyText="None adopted yet">
              {fwCompetencies.slice(0, 6).map((c) => (
                <FrameworkTag key={c.id} label={c.name} sub={c.minimumThreshold != null ? `≥${c.minimumThreshold}%` : null} />
              ))}
              {fwCompetencies.length > 6 && <FrameworkTag label={`+${fwCompetencies.length - 6} more`} color="#9CA3AF" bg="#F9FAFB" border="#E5E7EB" />}
            </FrameworkPanel>

            <FrameworkPanel icon={<FolderIcon fontSize="small" />} title="Pathways" count={fwPathways.length} emptyText="None added yet">
              {fwPathways.slice(0, 6).map((a) => (
                <FrameworkTag key={a.id} label={a.name} color={a.color || "#25476a"} bg={`${a.color || "#25476a"}12`} border={`${a.color || "#25476a"}40`} />
              ))}
              {fwPathways.length > 6 && <FrameworkTag label={`+${fwPathways.length - 6} more`} color="#9CA3AF" bg="#F9FAFB" border="#E5E7EB" />}
            </FrameworkPanel>

            <FrameworkPanel icon={<TrendingUpIcon fontSize="small" />} title="Progress Arc" count={fwPerformanceBands.length} emptyText="No performance bands yet">
              {[...fwPerformanceBands].sort((x, y) => (x.order || 0) - (y.order || 0)).slice(0, 6).map((band) => (
                <FrameworkTag
                  key={band.id}
                  label={band.name}
                  sub={band.minScore != null && band.maxScore != null ? `${band.minScore}–${band.maxScore}%` : null}
                  color="#7C3AED" bg="#F5F3FF" border="#DDD6FE"
                />
              ))}
              {fwPerformanceBands.length > 6 && <FrameworkTag label={`+${fwPerformanceBands.length - 6} more`} color="#9CA3AF" bg="#F9FAFB" border="#E5E7EB" />}
              {(fwProgressLevels.length > 0 || fwAgeCategories.length > 0) && (
                <p style={{ margin: "4px 0 0", width: "100%", fontSize: "11px", color: "#9CA3AF" }}>
                  {fwProgressLevels.length} progress level{fwProgressLevels.length !== 1 ? "s" : ""} · {fwAgeCategories.length} developmental stage{fwAgeCategories.length !== 1 ? "s" : ""}
                </p>
              )}
            </FrameworkPanel>

            <FrameworkPanel icon={<BarChartIcon fontSize="small" />} title="Assessment Framework" count={fwAssessmentTypes.length} emptyText="No assessment types yet">
              {fwAssessmentTypes.map((at) => (
                <FrameworkTag key={at.id} label={at.name} sub={at.typeWeight != null ? `${at.typeWeight}%` : null} color="#059669" bg="#ECFDF5" border="#A7F3D0" />
              ))}
              {(fwEvidenceTypes.length > 0 || fwPerformanceBands.length > 0) && (
                <p style={{ margin: "4px 0 0", width: "100%", fontSize: "11px", color: "#9CA3AF" }}>
                  {fwEvidenceTypes.length} evidence type{fwEvidenceTypes.length !== 1 ? "s" : ""} · {fwPerformanceBands.length} performance band{fwPerformanceBands.length !== 1 ? "s" : ""}
                </p>
              )}
            </FrameworkPanel>
          </div>
        )}
      </div>

      {/* ── Attached Courses ─────────────────────────────────────────────
         Courses are created independently in the Courses module — a course is
         added to (or removed from) this curriculum here, not from the course itself. */}
      <div id="courses" style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", overflow: "hidden", marginBottom: "20px", scrollMarginTop: "76px" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827" }}>Attached Courses</h2>
            <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#9CA3AF" }}>Courses currently used by this curriculum — a course stays independent otherwise.</p>
          </div>
          <AddCourseDropdown
            // Only Active courses are offerable — Draft ones aren't ready and Archived ones are
            // retired. Courses saved before status existed have no status field at all, which
            // counts as Active (matches CoursePickerField's same rule). Already-attached courses
            // stay visible below regardless of status — this only gates *new* attachments.
            available={allCourses.filter((c) => !attachedCourses.some((a) => a.id === c.id) && (c.status || "active") === "active")}
            onAdd={(courseId) => linkCourse(courseId)}
          />
        </div>
        <div style={{ padding: "16px 20px" }}>
          {attachedCourses.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: "#9CA3AF" }}>
              <div style={{ marginBottom: "8px" }}><MenuBookIcon sx={{ fontSize: 28 }} /></div>
              <p style={{ margin: 0, fontSize: "13px" }}>No courses added to this curriculum yet.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {attachedCourses.map((c) => {
                const sc = STATUS_CONFIG[c.status] || STATUS_CONFIG.active;
                // Where this course actually sits in the live version's content — cross-links
                // this list with Course Assignments so they read as one picture. Not found means
                // it's attached to the curriculum but not yet placed under any class/period.
                const placements = courseAssignmentIndex.get(c.id) || [];
                return (
                  <div
                    key={c.id}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "10px 14px", borderRadius: "10px", border: "1px solid #E5E7EB" }}
                  >
                    <Link
                      to={`/courses/${c.id}/view`}
                      style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none", minWidth: 0, flex: 1 }}
                    >
                      <span style={{ display: "flex", color: "#25476a", flexShrink: 0 }}><MenuBookIcon fontSize="small" /></span>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</p>
                        {c.code && <p style={{ margin: "0 0 3px", fontSize: "11px", color: "#9CA3AF" }}>{c.code}</p>}
                        {placements.length > 0 ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "3px" }}>
                            {placements.map((p, i) => (
                              <span key={i} style={{ fontSize: "10.5px", fontWeight: "600", color: "#25476a", backgroundColor: "#e8f5fb", border: "1px solid #a8d5ee", borderRadius: "20px", padding: "1px 8px", whiteSpace: "nowrap" }}>
                                {p.periodName} · {p.className}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p style={{ margin: "3px 0 0", fontSize: "10.5px", color: "#D97706", fontStyle: "italic" }}>Not yet assigned to a class</p>
                        )}
                      </div>
                    </Link>
                    <span style={{ padding: "2px 9px", borderRadius: "20px", fontSize: "10.5px", fontWeight: "700", backgroundColor: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, flexShrink: 0, whiteSpace: "nowrap" }}>
                      {sc.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => unlinkCourse(c.id)}
                      title="Remove from this curriculum"
                      style={{
                        width: "22px", height: "22px", borderRadius: "50%", border: "none", flexShrink: 0,
                        background: "#F3F4F6", color: "#6B7280", cursor: "pointer",
                        display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "700", padding: 0,
                      }}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Learning Hubs Using This Curriculum ───────────────────────── */}
      <div id="hubs" style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", overflow: "hidden", marginBottom: "20px", scrollMarginTop: "76px" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827" }}>Learning Hubs Using This Curriculum</h2>
          <span style={{ padding: "2px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", backgroundColor: "#e8f5fb", color: "#25476a", border: "1px solid #a8d5ee" }}>
            {assignedSchools.length}
          </span>
        </div>
        <div style={{ padding: "16px 20px" }}>
          {assignedSchools.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: "#9CA3AF" }}>
              <div style={{ fontSize: "24px", display: "flex", justifyContent: "center", marginBottom: "8px" }}><LocationOnIcon fontSize="inherit" /></div>
              <p style={{ margin: 0, fontSize: "13px" }}>No learning hubs have been assigned this curriculum yet.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {assignedSchools.map((s) => (
                <div
                  key={s.id}
                  onClick={() => navigate(`/learning-hubs/${s.id}/view`)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: "10px", border: "1px solid #E5E7EB", cursor: "pointer", transition: "background-color 0.12s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#F9FAFB"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ display: "flex", color: "#25476a" }}><HomeIcon fontSize="small" /></span>
                    <div>
                      <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#111827" }}>{s.name}</p>
                      <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF" }}>
                        {s.code}{s.address?.county ? ` · ${s.address.county}` : ""}
                      </p>
                    </div>
                  </div>
                  <span style={{
                    padding: "2px 8px", borderRadius: "20px", fontSize: "11px", fontWeight: "700",
                    backgroundColor: s.status === "active" ? "#e8f5fb" : "#F9FAFB",
                    color: s.status === "active" ? "#25476a" : "#6B7280",
                    border: `1px solid ${s.status === "active" ? "#a8d5ee" : "#E5E7EB"}`,
                  }}>
                    {s.status === "active" ? "Active" : "Inactive"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Version Control ──────────────────────────────────────────────
         Two separate systems both live under this app's "version control" vocabulary — course
         content (this curriculum's own CurriculumVersion records) and the Academic Year's own
         term-dates versioning. Shown side by side so "is the content live" and "is the calendar
         live" are both answerable here without a separate page visit for either. */}
      <div id="version-control" style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", overflow: "hidden", marginBottom: "20px", scrollMarginTop: "76px" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6" }}>
          <h2 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827" }}>Version Control</h2>
          <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#9CA3AF" }}>Course content and academic-year calendar are versioned separately</p>
        </div>

        <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
          {/* Content Version status card */}
          <div style={{ padding: "14px 16px", borderRadius: "14px", border: "1px solid #E5E7EB", backgroundColor: "#FAFBFF" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", fontWeight: "700", color: "#111827" }}>
                <FolderCopyIcon fontSize="small" style={{ color: "#25476a" }} /> Content Version
              </span>
              <ManageLink onClick={() => navigate(`/curriculum/${id}/versions`)} />
            </div>
            {!current ? (
              <p style={{ margin: 0, fontSize: "12.5px", color: "#9CA3AF" }}>No version created yet</p>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <span style={{ fontSize: "16px", fontWeight: "800", color: "#25476a" }}>v{current.versionNumber}</span>
                  {(() => {
                    const sc = STATUS_CONFIG[current.status] || STATUS_CONFIG.inactive;
                    return (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "2px 10px", borderRadius: "20px", backgroundColor: sc.bg, color: sc.color, border: `1.5px solid ${sc.border}`, fontSize: "11px", fontWeight: "700" }}>
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: sc.dot }} /> {sc.label}
                      </span>
                    );
                  })()}
                </div>
                <p style={{ margin: 0, fontSize: "11.5px", color: "#9CA3AF" }}>
                  {history.length + 1} version{history.length + 1 !== 1 ? "s" : ""} recorded
                </p>
              </>
            )}
          </div>

          {/* Academic Year status card */}
          <div style={{ padding: "14px 16px", borderRadius: "14px", border: "1px solid #E5E7EB", backgroundColor: "#FAFBFF" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", fontWeight: "700", color: "#111827" }}>
                <CalendarMonthIcon fontSize="small" style={{ color: "#25476a" }} /> Academic Year
              </span>
              {!curriculum.isProgram && (
                <ManageLink onClick={() => navigate(`/curriculum/${id}/academic-year`)} />
              )}
            </div>
            {!publishedAYVersion ? (
              <p style={{ margin: 0, fontSize: "12.5px", color: "#9CA3AF" }}>{ayVersions.length === 0 ? "No academic year set up yet" : "No published calendar yet"}</p>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <span style={{ fontSize: "16px", fontWeight: "800", color: "#25476a" }}>{activeYearLabel}</span>
                  {(() => {
                    const sc = STATUS_CONFIG[publishedAYVersion.status] || STATUS_CONFIG.published;
                    return (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "2px 10px", borderRadius: "20px", backgroundColor: sc.bg, color: sc.color, border: `1.5px solid ${sc.border}`, fontSize: "11px", fontWeight: "700" }}>
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: sc.dot }} /> {sc.label}
                      </span>
                    );
                  })()}
                </div>
                <p style={{ margin: 0, fontSize: "11.5px", color: "#9CA3AF" }}>
                  v{publishedAYVersion.versionNumber} live · {ayVersions.length} version{ayVersions.length !== 1 ? "s" : ""} recorded
                  {ayHasDraft && <span style={{ color: "#D97706", fontWeight: "600" }}> · has an unpublished draft</span>}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Quick list of content versions */}
        {(history.length > 0 || current) && (
          <div style={{ padding: "4px 20px 16px" }}>
            <p style={{ margin: "8px 0 6px", fontSize: "10px", fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.07em" }}>Content Version History</p>
            {[current, ...history].filter(Boolean).map((v) => {
              const sc = STATUS_CONFIG[v.status] || STATUS_CONFIG.inactive;
              return (
                <div key={v.id} style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "10px 0", borderTop: "1px solid #F3F4F6",
                }}>
                  <span style={{
                    width: "30px", height: "30px", borderRadius: "8px", flexShrink: 0,
                    backgroundColor: v.isCurrent ? "#25476a" : "#F3F4F6",
                    color: v.isCurrent ? "#fff" : "#6B7280",
                    fontSize: "11px", fontWeight: "800",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                  }}>
                    v{v.versionNumber}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#111827" }}>
                      Version {v.versionNumber}
                      {v.isCurrent && <span style={{ marginLeft: "6px", fontSize: "10px", color: "#25476a", fontWeight: "700" }}>· CURRENT</span>}
                    </p>
                    <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF" }}>
                      {new Date(v.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <span style={{
                    padding: "2px 9px", borderRadius: "20px", fontSize: "10px", fontWeight: "700",
                    backgroundColor: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                    textTransform: "uppercase", letterSpacing: "0.04em",
                  }}>
                    {sc.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ height: "32px" }} />
    </div>
  );
}
