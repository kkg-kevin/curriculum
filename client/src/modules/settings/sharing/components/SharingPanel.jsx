import { useMemo, useState } from "react";
import { FiCheck, FiDownload, FiSend, FiShare2, FiX } from "react-icons/fi";
import { Modal } from "../../components/Modal";
import {
  useAcceptConnection, useConnections, useCopyShared, useRemoveConnection, useRequestConnection, useSharedContent, useSharingKinds,
} from "../hooks/useSharing";

// Sharing between admins. Each admin is their own workspace; two who connect can browse each
// other's content and copy what they want into their own. A copy is theirs to change — it
// doesn't follow later edits by the admin it came from, and editing it changes nothing for them.

const sectionTitle = { margin: "22px 0 10px", fontSize: 12, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", color: "#6B7280" };
const pill = (active) => ({
  padding: "6px 12px", borderRadius: 999, border: `1.5px solid ${active ? "#25476a" : "#E5E7EB"}`, background: active ? "#25476a" : "#fff",
  color: active ? "#fff" : "#374151", fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer", whiteSpace: "nowrap",
});

// "2 courses added. Also brought in 4 assessments and 3 competencies. 1 was already in your workspace."
function summarise(result) {
  const parts = [];
  if (result.added) parts.push(`${result.label} added to your workspace.`);
  if (result.alsoCreated?.length) parts.push(`Also brought in ${result.alsoCreated.join(", ")}.`);
  if (result.alreadyHad) parts.push(`${result.alreadyHad} ${result.alreadyHad === 1 ? "was" : "were"} already in your workspace.`);
  return parts.join(" ") || "Nothing new to add.";
}

function ContentBrowser({ connection, onClose }) {
  const { data: kinds = [] } = useSharingKinds();
  const [kind, setKind] = useState("competencies");
  const [selected, setSelected] = useState(() => new Set());
  const [lastResult, setLastResult] = useState(null);
  const { data: rows, isLoading, isError } = useSharedContent(connection.id, kind);
  const { mutate: copy, isPending } = useCopyShared(connection.id);

  const list = rows || [];
  const available = useMemo(() => list.filter((row) => !row.inMyWorkspace), [list]);
  const groups = useMemo(() => [...new Set(kinds.map((k) => k.group))], [kinds]);
  const comesWithEverything = ["courses", "assessments", "curricula"].includes(kind);

  const changeKind = (next) => { setKind(next); setSelected(new Set()); setLastResult(null); };
  const toggle = (id) => setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const allChosen = available.length > 0 && available.every((row) => selected.has(row.id));
  const toggleAll = () => setSelected(allChosen ? new Set() : new Set(available.map((row) => row.id)));
  const add = () => copy({ kind, ids: [...selected] }, { onSuccess: (result) => { setLastResult(summarise(result)); setSelected(new Set()); } });

  return (
    <Modal
      title={`${connection.admin.name}'s content`}
      subtitle="Choose what to add to your workspace. You get your own copy to change as you like — theirs stays as it is."
      width={780}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="stg-btn-secondary" onClick={onClose}>Close</button>
          <button type="button" className="stg-btn-primary" disabled={isPending || selected.size === 0} onClick={add}>
            <FiDownload size={14} strokeWidth={2.2} /> {isPending ? "Adding…" : `Add to my workspace${selected.size ? ` (${selected.size})` : ""}`}
          </button>
        </>
      )}
    >
      <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
        {groups.map((group) => (
          <div key={group} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ width: 64, fontSize: 11, fontWeight: 800, color: "#9CA3AF", textTransform: "uppercase" }}>{group}</span>
            {kinds.filter((k) => k.group === group).map((k) => (
              <button key={k.key} type="button" style={{ ...pill(kind === k.key), textTransform: "capitalize" }} onClick={() => changeKind(k.key)}>{k.label}</button>
            ))}
          </div>
        ))}
      </div>

      {comesWithEverything && (
        <p style={{ margin: "0 0 12px", padding: "9px 12px", borderRadius: 9, background: "#F0F7FF", color: "#25476a", fontSize: 12.5, lineHeight: 1.5 }}>
          {kind === "curricula"
            ? "A curriculum comes with everything in it: its framework, its courses, their assessments, and the competencies, pathways and materials they use."
            : kind === "courses"
              ? "A course comes with its modules, sessions, the assessments its sessions use, and the competencies, pathways and materials they're tagged with."
              : "An assessment comes with the competencies, pathways and materials it's tagged with."}
          {" "}Anything you already have isn't copied twice.
        </p>
      )}

      {lastResult && (
        <p style={{ margin: "0 0 12px", padding: "9px 12px", borderRadius: 9, background: "#ECFDF5", color: "#065F46", fontSize: 12.5, fontWeight: 600, lineHeight: 1.5 }}>{lastResult}</p>
      )}

      {isLoading && <div className="stg-spinner" />}
      {isError && <p style={{ margin: 0, fontSize: 13, color: "#DC2626" }}>Couldn't load this — try again.</p>}
      {!isLoading && !isError && list.length === 0 && (
        <p style={{ margin: "18px 0", textAlign: "center", fontSize: 13, color: "#9CA3AF" }}>{connection.admin.name} has nothing here yet.</p>
      )}

      {!isLoading && list.length > 0 && (
        <>
          <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 8px", fontSize: 12.5, fontWeight: 700, color: "#374151", cursor: available.length ? "pointer" : "default" }}>
            <input type="checkbox" checked={allChosen} disabled={available.length === 0} onChange={toggleAll} />
            {available.length ? `Select all (${available.length})` : "You already have all of these"}
          </label>
          <div style={{ maxHeight: 340, overflowY: "auto", border: "1px solid #E5E7EB", borderRadius: 10 }}>
            {list.map((row, index) => (
              <label
                key={row.id}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", cursor: row.inMyWorkspace ? "default" : "pointer",
                  borderTop: index ? "1px solid #F3F4F6" : "none", background: selected.has(row.id) ? "#F0F7FF" : "#fff",
                }}
              >
                <input type="checkbox" checked={selected.has(row.id)} disabled={row.inMyWorkspace} onChange={() => toggle(row.id)} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</span>
                  {row.detail && <span style={{ display: "block", fontSize: 11.5, color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.detail}</span>}
                </span>
                {row.inMyWorkspace && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#059669", background: "#ECFDF5", borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>
                    <FiCheck size={11} strokeWidth={3} /> In your workspace
                  </span>
                )}
              </label>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

function ConnectionRow({ connection, children }) {
  return (
    <div className="stg-item">
      <div className="stg-item-top">
        <span className="stg-item-dot" style={{ background: connection.status === "accepted" ? "#059669" : "#feb139" }} />
        <div className="stg-item-name">{connection.admin.name}</div>
        {children}
      </div>
      <div className="stg-item-sub">{connection.admin.email}</div>
    </div>
  );
}

export default function SharingPanel() {
  const { data: connections, isLoading } = useConnections();
  const { mutate: request, isPending: isRequesting } = useRequestConnection();
  const { mutate: accept, isPending: isAccepting } = useAcceptConnection();
  const { mutate: remove } = useRemoveConnection();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [browsing, setBrowsing] = useState(null);

  const list = connections || [];
  const received = list.filter((c) => c.status === "pending" && c.direction === "received");
  const connected = list.filter((c) => c.status === "accepted");
  const sent = list.filter((c) => c.status === "pending" && c.direction === "sent");

  const send = () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter the other admin's email address");
    request(email.trim(), { onSuccess: () => { setEmail(""); setError(""); } });
  };
  const confirmRemove = (connection, message) => { if (window.confirm(message)) remove(connection.id); };

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0F2645" }}>Sharing</h2>
        <p style={{ margin: "3px 0 0", fontSize: 12, color: "#9CA3AF", maxWidth: 620, lineHeight: 1.6 }}>
          Connect with another admin to use each other's content. Once they accept, each of you can browse the other's competencies, pathways,
          system levels, items, courses, assessments and curricula, and add any of it to your own workspace. What you add is your own copy:
          change it freely, theirs stays as it is.
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 260px", maxWidth: 380 }}>
          <input
            className="stg-input" type="email" value={email} placeholder="Other admin's email"
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          />
          {error && <p style={{ margin: "5px 0 0", fontSize: 12, color: "#DC2626" }}>{error}</p>}
        </div>
        <button type="button" className="stg-btn-primary" disabled={isRequesting} onClick={send}>
          <FiSend size={14} strokeWidth={2.2} /> {isRequesting ? "Sending…" : "Send request"}
        </button>
      </div>

      {isLoading && <div className="stg-spinner" />}

      {!isLoading && list.length === 0 && (
        <div className="stg-empty" style={{ marginTop: 18 }}>
          <div style={{ marginBottom: 12, color: "#25476a" }}><FiShare2 size={38} strokeWidth={1.8} /></div>
          <p style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800, color: "#374151" }}>Not sharing with anyone yet</p>
          <p style={{ margin: 0, fontSize: 13, color: "#9CA3AF", maxWidth: 380, marginInline: "auto", lineHeight: 1.6 }}>
            Send a request to another admin. Nothing is visible to either of you until they accept.
          </p>
        </div>
      )}

      {received.length > 0 && (
        <>
          <h3 style={sectionTitle}>Requests for you</h3>
          <div className="stg-list">
            {received.map((c) => (
              <ConnectionRow key={c.id} connection={c}>
                <button type="button" className="stg-btn-primary" disabled={isAccepting} onClick={() => accept(c.id)}><FiCheck size={14} strokeWidth={2.4} /> Accept</button>
                <button type="button" className="stg-btn-secondary" onClick={() => confirmRemove(c, `Decline the request from ${c.admin.name}?`)}>Decline</button>
              </ConnectionRow>
            ))}
          </div>
        </>
      )}

      {connected.length > 0 && (
        <>
          <h3 style={sectionTitle}>Connected</h3>
          <div className="stg-list">
            {connected.map((c) => (
              <ConnectionRow key={c.id} connection={c}>
                <button type="button" className="stg-btn-primary" onClick={() => setBrowsing(c)}><FiDownload size={14} strokeWidth={2.2} /> Browse their content</button>
                <button
                  type="button" className="stg-icon-btn danger" title="End sharing"
                  onClick={() => confirmRemove(c, `Stop sharing with ${c.admin.name}? Neither of you will be able to browse the other's content. Anything already added to a workspace stays.`)}
                >
                  <FiX size={16} strokeWidth={2.2} />
                </button>
              </ConnectionRow>
            ))}
          </div>
        </>
      )}

      {sent.length > 0 && (
        <>
          <h3 style={sectionTitle}>Waiting for a reply</h3>
          <div className="stg-list">
            {sent.map((c) => (
              <ConnectionRow key={c.id} connection={c}>
                <button type="button" className="stg-btn-secondary" onClick={() => confirmRemove(c, `Withdraw your request to ${c.admin.name}?`)}>Withdraw</button>
              </ConnectionRow>
            ))}
          </div>
        </>
      )}

      {browsing && <ContentBrowser key={browsing.id} connection={browsing} onClose={() => setBrowsing(null)} />}
    </div>
  );
}
