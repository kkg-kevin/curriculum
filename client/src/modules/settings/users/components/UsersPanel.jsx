import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiDownload, FiSearch } from "react-icons/fi";
import { useWorkspaceUsers, useSetUserActive } from "../hooks/useWorkspaceUsers";
import ConfirmDialog from "../../../curriculum/components/ConfirmDialog";
import Pagination from "../../../billing/components/Pagination";
import { ago } from "../../../activity/labels";

// Settings → People & sharing → Users: every login in this workspace, the kind of account it is,
// what it is attached to, when it was last used, and a switch to stop it signing in without
// deleting anything. Read-only apart from that switch — people are still added and edited where
// they always were (Staff, Educators, Learners, Learning Hubs).

const PER_PAGE = 20;

const STATUS = {
  active: { label: "Active", color: "#047857", bg: "#ECFDF5", border: "#A7F3D0" },
  inactive: { label: "Inactive", color: "#92400E", bg: "#FEF3C7", border: "#FDE68A" },
  never: { label: "No sign-in recorded", color: "#6B7280", bg: "#F3F4F6", border: "#E5E7EB" },
  deactivated: { label: "Deactivated", color: "#B91C1C", bg: "#FEF2F2", border: "#FECACA" },
};

const RECORD_PATH = {
  hub: (id) => `/learning-hubs/${id}/view`,
  educator: (id) => `/teachers/${id}/view`,
  learner: (id) => `/learners/${id}/view`,
};

const selectStyle = { padding: "8px 10px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "Inter, sans-serif", background: "#fff", color: "#374151" };
const th = { textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1.5px solid #E5E7EB", whiteSpace: "nowrap" };
const td = { padding: "10px 12px", fontSize: 13, color: "#374151", borderBottom: "1px solid #F3F4F6", verticalAlign: "top" };

function Pill({ tone, children }) {
  return (
    <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", color: tone.color, backgroundColor: tone.bg, border: `1px solid ${tone.border}` }}>
      {children}
    </span>
  );
}

const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");

function downloadCsv(users) {
  const cell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const rows = [
    ["Name", "Email", "Username", "Account type", "Access role", "Attached to", "Status", "Last active", "Created"],
    ...users.map((u) => [u.name, u.email, u.username, u.typeLabel, u.accessRole || "", u.attachedTo, STATUS[u.status]?.label || u.status, u.lastActiveAt ? new Date(u.lastActiveAt).toISOString() : "", u.createdAt ? new Date(u.createdAt).toISOString() : ""]),
  ];
  const blob = new Blob([rows.map((r) => r.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "users.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export default function UsersPanel() {
  const { data, isLoading, isError } = useWorkspaceUsers();
  const { mutate: setActive, isPending } = useSetUserActive();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [confirm, setConfirm] = useState(null); // the user about to be deactivated
  const [page, setPage] = useState(1);

  const users = useMemo(() => data?.users || [], [data]);
  const summary = data?.summary;
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) =>
      (!type || u.type === type) &&
      (!status || u.status === status) &&
      (!q || [u.name, u.email, u.username, u.attachedTo, u.accessRole].some((v) => String(v || "").toLowerCase().includes(q)))
    );
  }, [users, search, type, status]);
  // Filtering is done above on the whole list; only the table is paged. Export CSV still takes
  // every matching user, not just this page.
  const pageCount = Math.max(1, Math.ceil(shown.length / PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = shown.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  if (isLoading) return <p style={{ fontSize: 13, color: "#6B7280" }}>Loading users…</p>;
  if (isError) return <p style={{ fontSize: 13, color: "#B91C1C" }}>Couldn't load users — try refreshing the page.</p>;

  return (
    <div>
      <ConfirmDialog
        isOpen={!!confirm}
        title={`Deactivate ${confirm?.name || "this account"}?`}
        message="They will be signed out now and won't be able to sign in until you activate the account again. Nothing of theirs is deleted."
        confirmLabel="Deactivate"
        variant="danger"
        onConfirm={() => { setActive({ id: confirm.id, active: false }); setConfirm(null); }}
        onCancel={() => setConfirm(null)}
      />

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0F2645" }}>Users</h3>
          <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#6B7280", maxWidth: 640, lineHeight: 1.5 }}>
            Everyone with a login in this workspace. "Inactive" means no activity for {data.inactiveAfterDays} days. Deactivating an account stops it signing in without deleting anything.
          </p>
        </div>
        <button
          type="button" onClick={() => downloadCsv(shown)} disabled={shown.length === 0}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", color: "#25476a", fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: shown.length ? "pointer" : "not-allowed" }}
        >
          <FiDownload size={14} /> Export CSV
        </button>
      </div>

      {/* Counts — each one filters the list */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {[{ type: "", label: "All", count: summary.total }, ...summary.byType].map((t) => {
          const on = type === t.type;
          return (
            <button
              key={t.type || "all"} type="button" onClick={() => { setType(t.type); setPage(1); }} aria-pressed={on}
              style={{ padding: "6px 12px", borderRadius: 20, border: `1.5px solid ${on ? "#25476a" : "#E5E7EB"}`, background: on ? "#25476a" : "#fff", color: on ? "#fff" : "#374151", fontSize: 12.5, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}
            >
              {t.label} <span style={{ opacity: 0.75, fontWeight: 700 }}>{t.count}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ position: "relative", flex: "1 1 240px" }}>
          <FiSearch size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }} />
          <input
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name, email, username, hub or role"
            style={{ ...selectStyle, width: "100%", boxSizing: "border-box", paddingLeft: 30 }}
          />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} style={selectStyle} aria-label="Status">
          <option value="">Any status</option>
          {Object.entries(STATUS).map(([key, s]) => (
            <option key={key} value={key}>{s.label} ({summary.byStatus[key] || 0})</option>
          ))}
        </select>
      </div>

      {shown.length === 0 ? (
        <p style={{ padding: "28px 0", textAlign: "center", fontSize: 13, color: "#9CA3AF" }}>No users match.</p>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid #E5E7EB", borderRadius: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Inter, sans-serif" }}>
            <thead>
              <tr>
                <th style={th}>User</th>
                <th style={th}>Account type</th>
                <th style={th}>Attached to</th>
                <th style={th}>Status</th>
                <th style={th}>Last active</th>
                <th style={th}>Created</th>
                <th style={{ ...th, textAlign: "right" }}>Sign-in</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((u) => {
                const path = u.record && RECORD_PATH[u.record.kind]?.(u.record.id);
                return (
                  <tr key={u.id} style={{ opacity: u.status === "deactivated" ? 0.7 : 1 }}>
                    <td style={td}>
                      <div style={{ fontWeight: 700, color: "#111827" }}>
                        {path ? <Link to={path} style={{ color: "#25476a", textDecoration: "none" }}>{u.name || "(no name)"}</Link> : (u.name || "(no name)")}
                      </div>
                      <div style={{ fontSize: 12, color: "#6B7280", wordBreak: "break-all" }}>{u.email || (u.username ? `@${u.username}` : "")}</div>
                    </td>
                    <td style={td}>
                      <div>{u.typeLabel}</div>
                      {u.accessRole && <div style={{ fontSize: 12, color: "#6B7280" }}>Role: {u.accessRole}</div>}
                    </td>
                    <td style={{ ...td, maxWidth: 260 }}>{u.attachedTo || "—"}</td>
                    <td style={td}>
                      <Pill tone={STATUS[u.status] || STATUS.never}>{STATUS[u.status]?.label || u.status}</Pill>
                      {u.suspended && u.status !== "deactivated" && (
                        <div style={{ marginTop: 4 }}><Pill tone={STATUS.inactive}>Record suspended</Pill></div>
                      )}
                    </td>
                    <td style={{ ...td, whiteSpace: "nowrap" }} title={u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleString() : undefined}>
                      {u.lastActiveAt ? ago(u.lastActiveAt) : "—"}
                    </td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{formatDate(u.createdAt)}</td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                      {!u.canDeactivate ? (
                        <span style={{ fontSize: 12, color: "#9CA3AF" }}>You</span>
                      ) : u.status === "deactivated" ? (
                        <button
                          type="button" disabled={isPending} onClick={() => setActive({ id: u.id, active: true })}
                          style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid #A7F3D0", background: "#ECFDF5", color: "#047857", fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}
                        >
                          Activate
                        </button>
                      ) : (
                        <button
                          type="button" disabled={isPending} onClick={() => setConfirm(u)}
                          style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", color: "#B91C1C", fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination page={currentPage} pageCount={pageCount} onChange={setPage} />
        </div>
      )}
      <p style={{ margin: "10px 0 0", fontSize: 11.5, color: "#9CA3AF" }}>
        {shown.length > PER_PAGE
          ? `Showing ${(currentPage - 1) * PER_PAGE + 1}–${Math.min(currentPage * PER_PAGE, shown.length)} of ${shown.length}${shown.length < summary.total ? ` matching (${summary.total} in all)` : ""}.`
          : `Showing ${shown.length} of ${summary.total}.`} Last active comes from the activity log, which began on 2 Oct 2026 — an account not used since then shows "No sign-in recorded".
      </p>
    </div>
  );
}
