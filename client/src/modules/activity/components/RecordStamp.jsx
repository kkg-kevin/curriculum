import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FiClock, FiEdit3, FiPlusCircle, FiTrash2, FiUsers } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { Modal } from "../../checkins/shared";
import { activityApi } from "../services/activityApi";
import { useActivity } from "../hooks/useActivity";
import { accountLabel, ago } from "../labels";
import { canSeeRecordHistory } from "./RecordHistory";
import ActivityEntry from "./ActivityEntry";

// The stamp inside a record's page (12 Nov 2026) — who created it, who changed it last (the record
// or any of its parts: a course's sessions and modules, a curriculum's stages and pathways…), how
// many changes by how many people, and a History window with every one of them. From the activity
// log (server: audit-log.model.js's stamp / RECORDS):
//   <RecordStamp type="courses" id={course.id} />
// `type` is the table the record lives in. Admin side only: the workspace owner, and staff whose
// role grants Activity log → View — never the educator, hub or parent portals (the same pages are
// shared with them, so this hides itself there).

const LOG_BEGAN = "2026-10-02";
const day = (iso) => new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
const C = { ink: "#111827", muted: "#6B7280", faint: "#9CA3AF", line: "#EEF1F5", navy: "#25476a", sky: "#38aae1" };

function Who({ person }) {
  return (
    <>
      <strong style={{ color: C.ink, fontWeight: 700 }}>{person.actorName || "Someone"}</strong>
      {accountLabel(person) && <span style={{ color: C.faint }}> ({accountLabel(person)})</span>}
    </>
  );
}

// The record's stamp, for whoever may read the log.
function useStamp(type, id, enabled) {
  return useQuery({ queryKey: ["activity", "stamp", type, id], queryFn: () => activityApi.stamp(type, id), enabled: enabled && !!id, staleTime: 0, retry: false });
}

// "Who did what": the stamp in words, each person with their number of changes, then every
// change, newest first — for a page's stamp and for a list row's History button alike.
export function HistoryWindow({ type, id, title = "Who did what", onClose }) {
  const filters = useMemo(() => ({ recordType: type, recordId: id }), [type, id]);
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useActivity(filters);
  const { data: stamp } = useStamp(type, id, true);
  const entries = (data?.pages || []).flatMap((page) => page.items);
  return (
    <Modal title={title} onClose={onClose} width={720}>
      {stamp && (
        <p style={{ margin: "0 0 10px", fontSize: 12.5, color: C.muted, lineHeight: 1.6 }}>
          {stamp.created ? <>Created by <Who person={stamp.created} /> · {day(stamp.created.createdAt)}</> : stamp.recordCreatedAt ? <>Created {day(stamp.recordCreatedAt)}{String(new Date(stamp.recordCreatedAt).toISOString()).slice(0, 10) < LOG_BEGAN ? " — before activity records began" : ""}</> : null}
          {stamp.last && <><br />Last changed by <Who person={stamp.last} /> · {ago(stamp.last.createdAt)}</>}
        </p>
      )}
      {stamp?.people?.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {stamp.people.map((p) => (
            <span key={p.actorUserId || p.actorName} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 999, background: "#F1F9FD", border: "1px solid #BFE3F7", fontSize: 12.5, color: C.navy }}>
              <strong>{p.actorName || "Someone"}</strong>
              <span style={{ color: C.muted }}>{p.count} change{p.count === 1 ? "" : "s"} · last {ago(p.lastAt)}</span>
            </span>
          ))}
        </div>
      )}
      {isLoading && <p style={{ margin: 0, fontSize: 13, color: C.faint }}>Loading…</p>}
      {!isLoading && !entries.length && <p style={{ margin: 0, fontSize: 13, color: C.faint }}>Nothing recorded for this yet.</p>}
      {entries.map((entry) => <ActivityEntry key={entry.id} entry={entry} compact showDate />)}
      {hasNextPage && (
        <button type="button" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} style={{ marginTop: 10, padding: "7px 14px", borderRadius: 9, border: "1.5px solid #E5E7EB", background: "#fff", color: C.navy, fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
          {isFetchingNextPage ? "Loading…" : "Show earlier"}
        </button>
      )}
    </Modal>
  );
}

export default function RecordStamp({ type, id, style = null }) {
  const { user } = useAuth();
  const allowed = canSeeRecordHistory(user);
  const [open, setOpen] = useState(false);
  const { data: stamp } = useStamp(type, id, allowed);
  if (!allowed || !id || !stamp) return null;

  const beforeLog = !stamp.created && stamp.recordCreatedAt && String(new Date(stamp.recordCreatedAt).toISOString()).slice(0, 10) < LOG_BEGAN;
  const row = { display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0, flexWrap: "wrap" };
  const LastIcon = stamp.last?.action === "delete" || stamp.last?.action === "unlink" ? FiTrash2 : FiEdit3;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px 18px", flexWrap: "wrap", padding: "10px 16px", borderRadius: 12, background: "#fff", border: `1px solid ${C.line}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)", fontSize: 12.5, color: C.muted, fontFamily: "Inter, sans-serif", ...(style || {}) }}>
      <span style={row}>
        <FiPlusCircle size={13} color={C.sky} />
        {stamp.created ? <>Created by <Who person={stamp.created} /> · {day(stamp.created.createdAt)}</>
          : stamp.recordCreatedAt ? <>Created {day(stamp.recordCreatedAt)}{beforeLog ? " — before activity records began" : " — who isn't recorded (a copy, or made by the system)"}</>
            : "Creator not recorded"}
      </span>
      <span style={row} title={stamp.last?.summary || undefined}>
        <LastIcon size={13} color={C.sky} />
        {stamp.last ? <>Last changed by <Who person={stamp.last} /> · {ago(stamp.last.createdAt)}</> : "Not changed since"}
      </span>
      {stamp.total > 0 && (
        <span style={row}>
          <FiUsers size={13} color={C.sky} />
          {stamp.total} change{stamp.total === 1 ? "" : "s"} by {stamp.people.length} {stamp.people.length === 1 ? "person" : "people"}{stamp.deletes ? ` · ${stamp.deletes} removal${stamp.deletes === 1 ? "" : "s"}` : ""}
        </span>
      )}
      <button type="button" onClick={() => setOpen(true)} style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 999, border: "1px solid #BFE3F7", background: "#F1F9FD", color: C.navy, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
        <FiClock size={12} /> History
      </button>
      {open && <HistoryWindow type={type} id={id} onClose={() => setOpen(false)} />}
    </div>
  );
}

// A small "History" button for a record edited in a list or a pop-up (a package, a template, a
// catalogue entry…): opens the same "Who did what" window. Admin side only, like the stamp.
//   <HistoryButton type="pathway_packages" id={plan.id} label={plan.name} />
export function HistoryButton({ type, id, label = null, iconOnly = false, style = null }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  if (!canSeeRecordHistory(user) || !id) return null;
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        title="Who did what"
        aria-label={`History${label ? ` of ${label}` : ""}`}
        style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: iconOnly ? "6px" : "5px 10px", borderRadius: 999, border: "1px solid #BFE3F7", background: "#F1F9FD", color: C.navy, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif", lineHeight: 1, ...(style || {}) }}
      >
        <FiClock size={12} />{!iconOnly && " History"}
      </button>
      {open && <HistoryWindow type={type} id={id} title={label ? `Who did what — ${label}` : "Who did what"} onClose={() => setOpen(false)} />}
    </>
  );
}
