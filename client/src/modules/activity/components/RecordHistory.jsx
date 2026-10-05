import { useMemo, useState } from "react";
import { FiClock } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { can } from "../../../hooks/usePermissions";
import { useActivity } from "../hooks/useActivity";
import ActivityEntry from "./ActivityEntry";

// One record's own history — everything the activity log holds about it, newest first — as a
// card to drop onto that record's page:
//   <RecordHistory entityType="bootcamps" entityId={bootcamp.id} />
// `entityType` is the table the record lives in (what the log stores). Shown only to people who
// may read the activity log: the workspace owner, and staff whose role grants Activity log → View.
// Loads nothing until it is opened.
export default function RecordHistory({ entityType, entityId }) {
  const { user } = useAuth();
  // The record pages are shared with the hub and educator portals, whose logins can't read the log.
  const allowed = user?.role === "admin" || (user?.role === "collaborator" && can(user, "activity", "view"));
  const [open, setOpen] = useState(false);
  const filters = useMemo(() => ({ entityType, entityId }), [entityType, entityId]);
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useActivity(filters, { enabled: allowed && open && Boolean(entityId) });
  const entries = (data?.pages || []).flatMap((page) => page.items);

  if (!allowed || !entityId) return null;

  return (
    <div style={{ backgroundColor: "#fff", borderRadius: 16, padding: "18px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16, fontFamily: "Inter, sans-serif" }}>
      <button
        type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: 0, border: "none", background: "none", cursor: "pointer", fontFamily: "Inter, sans-serif" }}
      >
        <FiClock size={15} color="#38aae1" />
        <span style={{ fontSize: 13, fontWeight: 600, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.05em" }}>History</span>
        <span style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 600, color: "#25476a" }}>{open ? "Hide" : "Show who changed this, and when"}</span>
      </button>

      {open && (
        <div style={{ marginTop: 12 }}>
          {isLoading && <p style={{ margin: 0, fontSize: 13, color: "#9CA3AF" }}>Loading history…</p>}
          {!isLoading && entries.length === 0 && (
            <p style={{ margin: 0, fontSize: 13, color: "#9CA3AF" }}>Nothing recorded for this yet. Changes made from now on will appear here.</p>
          )}
          {entries.map((entry) => <ActivityEntry key={entry.id} entry={entry} compact showDate />)}
          {hasNextPage && (
            <button type="button" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} style={{ marginTop: 10, padding: "7px 14px", borderRadius: 9, border: "1.5px solid #E5E7EB", background: "#fff", color: "#25476a", fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
              {isFetchingNextPage ? "Loading…" : "Show earlier"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
