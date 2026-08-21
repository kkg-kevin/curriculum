import { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle as CheckCircleIcon, PauseCircle as PauseCircleIcon, School as SchoolIcon, Close as CloseIcon } from "@mui/icons-material";
import { useAuth } from "../../../context/AuthContext";
import { learnerCreatePath } from "../../../routes/portalPaths";
import { useLearningHubQuery as useSchoolQuery } from "../../learning-hubs/hooks/useLearningHub";
import { learnerApi } from "../services/learnerApi";
import { classApi } from "../../classes/services/classApi";
import { LearnerCard } from "../components/LearnerCard";
import BulkImportLearnersPanel from "../components/BulkImportLearnersPanel";
import { formatClassName } from "../../classes/utils/classDisplay";
import { useSearchLearners, useEnrollLearnerHub } from "../hooks/useLearners";

const GRAD_FROM = "#1a3550";
const GRAD_TO   = "#38aae1";

const selectStyle = { padding: "8px 32px 8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "Inter, sans-serif", backgroundColor: "#F9FAFB", color: "#374151", outline: "none", cursor: "pointer", appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%236B7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" };

// Finds a learner already enrolled at a DIFFERENT hub (by name, username, or registration
// number) and enrolls them here too — the only path a school has for this, since
// they can't otherwise view or search a learner outside their own hub at all. Partial match, so
// a name search can surface several candidates — pick one from the list before enrolling.
function AddExistingLearnerPanel({ schoolId, classes, onClose, onEnrolled }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState(undefined); // undefined = not searched, [] = no matches, array = matches
  const [selectedId, setSelectedId] = useState(null);
  const [classId, setClassId] = useState("");
  const { mutate: runSearch, isPending: searching } = useSearchLearners();
  const { mutate: enroll, isPending: enrolling } = useEnrollLearnerHub();

  const search = () => {
    const trimmed = term.trim();
    if (!trimmed) return;
    runSearch(trimmed, { onSuccess: (learners) => { setResults(learners); setSelectedId(null); setClassId(""); } });
  };

  const selected = results?.find((l) => l.id === selectedId) || null;

  const handleEnroll = () => {
    if (!selected) return;
    enroll(
      { learnerId: selected.id, data: { hubId: schoolId, classId, status: "active" } },
      { onSuccess: () => { setTerm(""); setResults(undefined); setSelectedId(null); onEnrolled?.(); } },
    );
  };

  return (
    <div style={{ backgroundColor: "#ffffff", borderRadius: 12, padding: "16px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", marginBottom: 20, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#111827" }}>Add an existing learner</p>
        <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>Close</button>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: "#6B7280" }}>
        Search by name, username, or registration number to find them if they're already enrolled at another hub.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          value={term}
          onChange={(e) => { setTerm(e.target.value); setResults(undefined); setSelectedId(null); }}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Name, username, or registration number"
          style={{ flex: 1, minWidth: 220, padding: "8px 10px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 13, fontFamily: "Inter, sans-serif" }}
        />
        <button
          type="button"
          onClick={search}
          disabled={!term.trim() || searching}
          style={{ padding: "8px 16px", backgroundColor: !term.trim() || searching ? "#b8d9ee" : "#25476a", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: !term.trim() || searching ? "not-allowed" : "pointer" }}
        >
          {searching ? "Searching…" : "Search"}
        </button>
      </div>

      {results?.length === 0 && (
        <p style={{ margin: 0, fontSize: 12.5, color: "#B91C1C" }}>No learner found matching "{term.trim()}".</p>
      )}

      {results?.length > 0 && !selected && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {results.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setSelectedId(l.id)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 12px", backgroundColor: "#FAFBFF", border: "1px solid #E5E7EB", borderRadius: 10, cursor: "pointer", textAlign: "left", fontFamily: "Inter, sans-serif" }}
            >
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#111827" }}>{l.firstName} {l.lastName}</p>
                <p style={{ margin: 0, fontSize: 11.5, color: "#9CA3AF" }}>
                  {[l.registrationNumber, l.username && `@${l.username}`].filter(Boolean).join(" · ") || "No username or registration number on file"}
                </p>
              </div>
              <span style={{ fontSize: 11.5, color: "#6B7280", flexShrink: 0 }}>
                {l.hubCount > 0 ? `${l.hubCount} other hub${l.hubCount === 1 ? "" : "s"}` : "Not enrolled anywhere yet"}
              </span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 12px", backgroundColor: "#FAFBFF", border: "1px solid #E5E7EB", borderRadius: 10 }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#111827" }}>{selected.firstName} {selected.lastName}</p>
            <p style={{ margin: 0, fontSize: 11.5, color: "#9CA3AF" }}>
              {selected.hubCount > 0 ? `Already enrolled at ${selected.hubCount} other hub${selected.hubCount === 1 ? "" : "s"}` : "Not enrolled anywhere yet"}
            </p>
          </div>
          {results.length > 1 && (
            <button type="button" onClick={() => setSelectedId(null)} style={{ background: "none", border: "none", color: "#6B7280", fontSize: 12, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
              ← Back to results
            </button>
          )}
          <select value={classId} onChange={(e) => setClassId(e.target.value)} style={{ ...selectStyle, minWidth: 160 }}>
            <option value="">— No class yet —</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{formatClassName(c)}</option>)}
          </select>
          <button
            type="button"
            onClick={handleEnroll}
            disabled={enrolling}
            style={{ padding: "8px 16px", backgroundColor: enrolling ? "#b8d9ee" : "#25476a", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: enrolling ? "not-allowed" : "pointer" }}
          >
            {enrolling ? "Enrolling…" : "Enroll here"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function SchoolLearnersPage() {
  const { schoolId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const backPath  = user?.role === "school" ? "/school-portal" : "/learners";
  const backLabel = user?.role === "school" ? "Dashboard" : "Learners";
  const [statusFilter, setStatusFilter] = useState("");
  const [showAddExisting, setShowAddExisting] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);

  const { data: school, isLoading: schoolLoading } = useSchoolQuery(schoolId);

  const { data: learnersData, isLoading: learnersLoading } = useQuery({
    queryKey: ["learners", "bySchool", schoolId, statusFilter],
    queryFn: () => learnerApi.getAll({ schoolId, ...(statusFilter ? { status: statusFilter } : {}) }),
    enabled: !!schoolId,
  });

  const { data: classesData, isLoading: classesLoading } = useQuery({
    queryKey: ["classes", "bySchool", schoolId],
    queryFn: () => classApi.getAll({ schoolId }),
    enabled: !!schoolId,
  });

  const learners = learnersData?.data || [];
  const classes  = classesData?.data  || [];
  const classMap = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c])), [classes]);
  const activeCount = learners.filter((l) => l.status === "active").length;

  if (schoolLoading) {
    return <div style={{ padding: 40, fontFamily: "Inter, sans-serif", color: "#6B7280" }}>Loading…</div>;
  }

  const isLoading = learnersLoading || classesLoading;

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <button type="button" onClick={() => navigate(backPath)}
          style={{ padding: 0, background: "none", border: "none", color: "#6B7280", fontSize: 13, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
          ← {backLabel}
        </button>
        <span style={{ color: "#D1D5DB", fontSize: 13 }}>/</span>
        <span style={{ fontSize: 13, color: "#111827", fontWeight: 600 }}>{school?.name || "School"}</span>
      </div>

      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg, ${GRAD_FROM} 0%, #25476a 40%, #2e7db5 75%, ${GRAD_TO} 100%)`, borderRadius: 20, padding: "28px 32px", marginBottom: 16, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "#ffffff", flexShrink: 0, overflow: "hidden" }}>
              {school?.photo ? (
                <img src={school.photo} alt={school.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (school?.name?.[0]?.toUpperCase() || "S")}
            </div>
            <div>
              <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.4px" }}>{school?.name}</h1>
              <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)" }}>
                {school?.address?.county ? `${school.address.county} County · ` : ""}Learners
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setShowBulkImport((s) => !s)}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 20px", backgroundColor: "rgba(255,255,255,0.15)", color: "#ffffff", border: "1.5px solid rgba(255,255,255,0.35)", borderRadius: 12, fontSize: 14, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              + Bulk Import
            </button>
            <button
              type="button"
              onClick={() => setShowAddExisting((s) => !s)}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 20px", backgroundColor: "rgba(255,255,255,0.15)", color: "#ffffff", border: "1.5px solid rgba(255,255,255,0.35)", borderRadius: 12, fontSize: 14, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              + Add Existing Learner
            </button>
            <button
              type="button"
              onClick={() => navigate(learnerCreatePath(user?.role, schoolId))}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 22px", backgroundColor: "#feb139", color: "#25476a", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer", boxShadow: "0 2px 8px rgba(254,177,57,0.35)", whiteSpace: "nowrap" }}
            >
              + Enrol Learner
            </button>
          </div>
        </div>
      </div>

      {showBulkImport && (
        <BulkImportLearnersPanel
          schoolId={schoolId}
          classes={classes}
          onClose={() => setShowBulkImport(false)}
          onImported={() => qc.invalidateQueries({ queryKey: ["learners", "bySchool", schoolId] })}
        />
      )}

      {showAddExisting && (
        <AddExistingLearnerPanel
          schoolId={schoolId}
          classes={classes}
          onClose={() => setShowAddExisting(false)}
          onEnrolled={() => {
            setShowAddExisting(false);
            qc.invalidateQueries({ queryKey: ["learners", "bySchool", schoolId] });
          }}
        />
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Total Learners", value: learnersLoading ? "—" : learners.length,              icon: <SchoolIcon fontSize="small" />, bg: "#e8f5fb", color: "#25476a", border: "#a8d5ee" },
          { label: "Active",         value: learnersLoading ? "—" : activeCount,                   icon: <CheckCircleIcon fontSize="small" />, bg: "#e8f5fb", color: "#38aae1", border: "#a8d5ee" },
          { label: "Other",          value: learnersLoading ? "—" : learners.length - activeCount, icon: <PauseCircleIcon fontSize="small" />, bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB" },
        ].map((stat) => (
          <div key={stat.label} style={{ backgroundColor: "#ffffff", borderRadius: 14, border: `1.5px solid ${stat.border}`, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, backgroundColor: stat.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{stat.icon}</div>
            <div>
              <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: stat.color, lineHeight: 1 }}>{stat.value}</p>
              <p style={{ margin: "3px 0 0", fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ backgroundColor: "#ffffff", borderRadius: 12, padding: "12px 16px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="transferred">Transferred</option>
          <option value="graduated">Graduated</option>
        </select>
        {statusFilter && (
          <button type="button" onClick={() => setStatusFilter("")}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 14px", backgroundColor: "transparent", color: "#6B7280", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            <CloseIcon fontSize="inherit" style={{ fontSize: 13 }} /> Clear
          </button>
        )}
        <span style={{ marginLeft: "auto", fontSize: 13, color: "#9CA3AF" }}>
          {learnersLoading ? "Loading…" : `${learners.length} learner${learners.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {isLoading ? (
        <div style={{ padding: "60px 20px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>Loading…</div>
      ) : learners.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 24px", backgroundColor: "#ffffff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "#111827" }}>No learners yet</h3>
          <p style={{ margin: 0, fontSize: 14, color: "#6B7280", lineHeight: 1.6 }}>Enrol this school's first learner to get started.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {learners.map((l) => (
            <LearnerCard key={l.id} learner={l} classMap={classMap} />
          ))}
        </div>
      )}
    </div>
  );
}
