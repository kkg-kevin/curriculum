import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { CheckCircle as CheckCircleIcon, Class as ClassIcon, Groups as GroupsIcon, PauseCircle as PauseCircleIcon } from "@mui/icons-material";
import { useDeleteLearner, useUpdateLearnerAccountStatus } from "../hooks/useLearners";
import { useAuth } from "../../../context/AuthContext";
import { learnerPath } from "../../../routes/portalPaths";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";
import { learnerApi } from "../services/learnerApi";
import { formatClassName } from "../../classes/utils/classDisplay";
import { learnerAge } from "../../../utils/learnerAge";
import { PersonAvatar, cellStyle, mutedText } from "../../../components/ui/PeopleViews";

// A learner in a list of learners, three ways (components/ui/PeopleViews.jsx): LearnerCard (the
// grid), LearnerListRow (List view) and LearnerTableRow (Table view, headed by
// learnerTableColumns). All three share LearnerActions — the ⋮ menu (View, Edit, and for admins
// Activate/Deactivate and Delete) — so every view can do the same things.
//
// `classMap` is only meaningful inside a single hub's own context (SchoolLearnersPage, where every
// learner is merged with that hub's enrollment fields) — omit it on the cross-hub admin list, where
// a learner may have several enrollments and no single class/status is well-defined.

const ACCENT = "#25476a";

const STATUS_STYLES = {
  active:      { bg: "#e8f5fb", color: "#25476a", border: "#a8d5ee", label: "Active"      },
  inactive:    { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB", label: "Inactive"    },
  transferred: { bg: "#e8f5fb", color: "#38aae1", border: "#a8d5ee", label: "Transferred" },
  graduated:   { bg: "#e8f5fb", color: "#25476a", border: "#a8d5ee", label: "Graduated"   },
  pending_payment: { bg: "#FFFBEB", color: "#B45309", border: "#FDE68A", label: "Waiting for payment" },
};

function StatusBadge({ status, label }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.inactive;
  return (
    <span style={{ padding: "2px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: "nowrap" }}>
      {label ? `${label}: ` : ""}{s.label}
    </span>
  );
}

function MenuButton({ icon, label, onClick, danger = false }) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "8px 10px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 500, fontFamily: "Inter, sans-serif", cursor: "pointer", textAlign: "left", transition: "background-color 0.12s", backgroundColor: hov ? (danger ? "#FFF5F5" : "#F3F4F6") : "transparent", color: danger ? "#EF4444" : (hov ? ACCENT : "#374151") }}>
      <span style={{ display: "flex", alignItems: "center", flexShrink: 0, opacity: 0.85 }}>{icon}</span>
      {label}
    </button>
  );
}

const fullName = (l) => `${l.firstName || ""} ${l.lastName || ""}`.trim();
const capitalise = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
// Hub-specific admission number wins when there's that context (SchoolLearnersPage); otherwise the
// learner's own permanent registration number, which is always there whatever the hub scope.
const numberLine = (l) => l.admissionNumber || l.registrationNumber || (l.hubCount > 0 ? `${l.hubCount} hub${l.hubCount !== 1 ? "s" : ""}` : "Not yet enrolled");
const ageOf = (l) => learnerAge(l).age;
const classNameOf = (l, classMap) => (classMap ? (formatClassName(classMap[l.classId]) || "Unassigned") : null);

// The ⋮ menu and the dialogs it opens. `onBusy(true)` while a delete runs (the card fades).
export function LearnerActions({ learner, onBusy }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { mutate: deleteLearner, isPending: isDeleting } = useDeleteLearner();
  const { mutate: updateAccountStatus } = useUpdateLearnerAccountStatus();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const accountStatus = learner.accountStatus || "active";

  useEffect(() => { onBusy?.(isDeleting); }, [isDeleting, onBusy]);

  const openMenu = () => {
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    setMenuOpen(true);
  };

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => {
      if (!triggerRef.current?.contains(e.target) && !dropdownRef.current?.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = () => setMenuOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [menuOpen]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Actions for ${fullName(learner)}`}
        onClick={(e) => { e.stopPropagation(); if (menuOpen) setMenuOpen(false); else openMenu(); }}
        style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: menuOpen ? "#e8f5fb" : "transparent", border: `1.5px solid ${menuOpen ? "#a8d5ee" : "transparent"}`, borderRadius: 8, cursor: "pointer", color: menuOpen ? ACCENT : "#9CA3AF", transition: "all 0.15s", flexShrink: 0 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
      </button>

      {menuOpen && createPortal(
        <div ref={dropdownRef} style={{ position: "fixed", top: menuPos.top, right: menuPos.right, backgroundColor: "#ffffff", border: "1px solid #E5E7EB", borderRadius: 14, boxShadow: "0 8px 28px rgba(0,0,0,0.12)", zIndex: 9999, minWidth: 192, overflow: "hidden", padding: 6 }}>
          <div style={{ padding: "8px 10px 10px", borderBottom: "1px solid #F3F4F6", marginBottom: 4 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#111827" }}>{fullName(learner)}</p>
            <p style={{ margin: "1px 0 0", fontSize: 11, color: "#9CA3AF" }}>{learner.admissionNumber}</p>
          </div>
          {[
            { label: "View", path: learnerPath(user?.role, learner.id, "view"), icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/></svg> },
            { label: "Edit", path: learnerPath(user?.role, learner.id, "edit"), icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
          ].map(({ label, path, icon }) => (
            <MenuButton key={path} icon={icon} label={label} onClick={() => { setMenuOpen(false); navigate(path); }} />
          ))}
          {/* Delete is admin-only server-side (learner.routes.js) — school gets "Remove
              from Hub" instead, from LearnerPage, so this menu shouldn't offer an action that's
              guaranteed to 403 for them. */}
          {user?.role === "admin" && (
            <>
              <MenuButton
                icon={accountStatus === "active" ? <PauseCircleIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                label={accountStatus === "active" ? "Deactivate account" : "Activate account"}
                onClick={() => { setMenuOpen(false); updateAccountStatus({ id: learner.id, accountStatus: accountStatus === "active" ? "inactive" : "active" }); }}
              />
              <div style={{ height: 1, backgroundColor: "#F3F4F6", margin: "4px 0" }} />
              <MenuButton
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                label="Delete" onClick={() => { setMenuOpen(false); setConfirmOpen(true); }} danger
              />
            </>
          )}
        </div>,
        document.body
      )}

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Delete Learner"
        message={`"${fullName(learner)}" will be permanently deleted.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => { setConfirmOpen(false); deleteLearner(learner.id); }}
        usageCheck={() => learnerApi.checkRemove(learner.id)}
        onAlternative={accountStatus === "active" ? () => { setConfirmOpen(false); updateAccountStatus({ id: learner.id, accountStatus: "inactive" }); } : undefined}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

function NameLink({ learner, hovered, size = 15 }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  return (
    <button type="button" onClick={() => navigate(learnerPath(user?.role, learner.id, "view"))}
      style={{ all: "unset", cursor: "pointer", fontSize: size, fontWeight: 700, color: hovered ? ACCENT : "#111827", transition: "color 0.15s", overflowWrap: "anywhere" }}>
      {fullName(learner)}
    </button>
  );
}

export function LearnerCard({ learner, classMap }) {
  const [hovered, setHovered] = useState(false);
  const [busy, setBusy] = useState(false);
  const gradeName = classNameOf(learner, classMap);
  const accountStatus = learner.accountStatus || "active";

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ backgroundColor: "#ffffff", borderRadius: 16, boxShadow: hovered ? "0 8px 24px rgba(37,71,106,0.10), 0 2px 6px rgba(0,0,0,0.05)" : "0 1px 4px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", overflow: "hidden", transition: "box-shadow 0.2s, transform 0.2s", transform: hovered ? "translateY(-2px)" : "translateY(0)", opacity: busy ? 0.5 : 1, pointerEvents: busy ? "none" : "auto" }}
    >
      <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <PersonAvatar person={learner} size={44} />
            <div style={{ minWidth: 0 }}>
              <h3 style={{ margin: "0 0 2px", fontSize: 15 }}><NameLink learner={learner} hovered={hovered} /></h3>
              <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF" }}>{numberLine(learner)}</p>
            </div>
          </div>
          <LearnerActions learner={learner} onBusy={setBusy} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid #F3F4F6", paddingTop: 10 }}>
          {gradeName && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6B7280" }}>
              <ClassIcon fontSize="small" sx={{ color: ACCENT }} />
              {gradeName}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6B7280" }}>
            <GroupsIcon fontSize="small" sx={{ color: ACCENT }} />
            {learner.guardianName
              ? learner.guardianName
              : <span style={{ color: "#D1D5DB", fontStyle: "italic" }}>No guardian on file</span>}
          </div>
        </div>

        <div style={{ marginTop: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {learner.accountStatus && <StatusBadge status={accountStatus} label="Account" />}
          {learner.status && <StatusBadge status={learner.status} label={classMap ? "Enrollment" : "Status"} />}
        </div>
      </div>
    </div>
  );
}

// List view: one row — who they are, their class (hub view), age, the parent, and status.
export function LearnerListRow({ learner, classMap }) {
  const [hovered, setHovered] = useState(false);
  const [busy, setBusy] = useState(false);
  const gradeName = classNameOf(learner, classMap);
  const age = ageOf(learner);
  const facts = [gradeName, age != null ? `Age ${age}` : null, capitalise(learner.gender)].filter(Boolean);

  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "12px 16px", borderBottom: "1px solid #F3F4F6", backgroundColor: hovered ? "#FAFCFE" : "#fff", opacity: busy ? 0.5 : 1, pointerEvents: busy ? "none" : "auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "2 1 220px", minWidth: 0 }}>
        <PersonAvatar person={learner} size={36} />
        <div style={{ minWidth: 0 }}>
          <NameLink learner={learner} hovered={hovered} size={14} />
          <p style={{ margin: "1px 0 0", fontSize: 12, color: "#9CA3AF" }}>{numberLine(learner)}</p>
        </div>
      </div>
      <div style={{ flex: "1 1 160px", minWidth: 0, fontSize: 13, color: "#6B7280" }}>
        {facts.length ? facts.join(" · ") : <span style={mutedText}>—</span>}
      </div>
      <div style={{ flex: "1.4 1 200px", minWidth: 0, fontSize: 13, color: "#6B7280" }}>
        {learner.guardianName
          ? <>{learner.guardianName}{learner.guardianPhone ? <span style={mutedText}> · {learner.guardianPhone}</span> : null}</>
          : <span style={{ color: "#D1D5DB", fontStyle: "italic" }}>No guardian on file</span>}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: "1 1 150px", justifyContent: "flex-start" }}>
        {learner.accountStatus && <StatusBadge status={learner.accountStatus || "active"} />}
        {classMap && learner.status && learner.status !== "active" && <StatusBadge status={learner.status} label="Enrollment" />}
      </div>
      <LearnerActions learner={learner} onBusy={setBusy} />
    </div>
  );
}

// Table view's columns — the hub's own view (classMap) shows the class and the enrollment there;
// the workspace-wide view how many hubs and when they joined.
export function learnerTableColumns({ classMap } = {}) {
  return [
    { key: "name", label: "Learner", sortValue: (l) => fullName(l).toLowerCase() },
    ...(classMap ? [{ key: "class", label: "Class", sortValue: (l) => classNameOf(l, classMap) }] : []),
    { key: "age", label: "Age", sortValue: (l) => ageOf(l), align: "right" },
    { key: "gender", label: "Gender", sortValue: (l) => genderOf(l) },
    { key: "parent", label: "Parent / guardian", sortValue: (l) => (l.guardianName || "").toLowerCase() },
    { key: "phone", label: "Parent's phone" },
    ...(classMap ? [] : [{ key: "hubs", label: "Hubs", sortValue: (l) => Number(l.hubCount || 0), align: "right" }]),
    { key: "account", label: "Account", sortValue: (l) => l.accountStatus || "active" },
    ...(classMap ? [{ key: "enrollment", label: "Enrollment", sortValue: (l) => l.status || "" }] : []),
    ...(classMap ? [] : [{ key: "joined", label: "Added", sortValue: (l) => (l.createdAt ? new Date(l.createdAt).getTime() : null) }]),
    { key: "actions", label: "", width: 44 },
  ];
}

function genderOf(l) {
  return capitalise(l.gender || "");
}

export function LearnerTableRow({ learner, classMap }) {
  const [busy, setBusy] = useState(false);
  const age = ageOf(learner);
  const dash = <span style={mutedText}>—</span>;
  return (
    <tr style={{ opacity: busy ? 0.5 : 1 }}>
      <td style={cellStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 180 }}>
          <PersonAvatar person={learner} size={30} />
          <div style={{ minWidth: 0 }}>
            <NameLink learner={learner} size={13.5} />
            <div style={{ fontSize: 11.5, color: "#9CA3AF" }}>{numberLine(learner)}</div>
          </div>
        </div>
      </td>
      {classMap && <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>{classNameOf(learner, classMap)}</td>}
      <td style={{ ...cellStyle, textAlign: "right" }}>{age ?? dash}</td>
      <td style={cellStyle}>{genderOf(learner) || dash}</td>
      <td style={cellStyle}>{learner.guardianName || dash}</td>
      <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>{learner.guardianPhone || dash}</td>
      {!classMap && <td style={{ ...cellStyle, textAlign: "right" }}>{Number(learner.hubCount || 0)}</td>}
      <td style={cellStyle}><StatusBadge status={learner.accountStatus || "active"} /></td>
      {classMap && <td style={cellStyle}>{learner.status ? <StatusBadge status={learner.status} /> : dash}</td>}
      {!classMap && <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>{learner.createdAt ? new Date(learner.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : dash}</td>}
      <td style={{ ...cellStyle, width: 44 }}><LearnerActions learner={learner} onBusy={setBusy} /></td>
    </tr>
  );
}
