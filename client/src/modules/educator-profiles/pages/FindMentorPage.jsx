import { useMemo, useState } from "react";
import { Link, useNavigate, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import { FiAward, FiClock, FiSearch, FiStar, FiUsers } from "react-icons/fi";
import Avatar from "../../../components/ui/Avatar";
import { Modal, QaStyles as CheckinStyles, btn, input, label } from "../../qa/shared";
import { useMentorDirectory, useRequestMentor } from "../hooks/useEducatorProfile";
import PublicProfileView from "../components/PublicProfileView";

// Find a mentor (parent portal, /parent/mentors): the published educators of the learning centres the
// family's children learn at — by rating, then hours — searchable by name, course or what they teach,
// and filtered by place and online. A profile (/parent/mentors/:slug) is the same one the share page
// shows — laid out like the educator page on the admin and educator side (header, key figures, tabs)
// — with "Ask for …": it goes to the team inside the system (nothing comes from the website).

function MentorCard({ m, onOpen }) {
  const [first, ...rest] = m.name.split(" ");
  return (
    <button type="button" onClick={onOpen} style={{ textAlign: "left", background: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10, cursor: "pointer", fontFamily: "inherit", minWidth: 0 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
        <Avatar firstName={first} lastName={rest.join(" ")} photo={m.photo} size={50} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#111827", overflowWrap: "anywhere" }}>{m.name}</p>
          {m.headline && <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#5B6475" }}>{m.headline}</p>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12.5, color: "#374151" }}>
        {m.rating.isNew ? <span style={{ fontWeight: 700, color: "#1F6F9E" }}>New educator</span> : <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><FiStar color="#feb139" /> <strong>{m.rating.average.toFixed(1)}</strong> ({m.rating.count})</span>}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><FiClock size={13} /> {m.hours} h</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><FiUsers size={13} /> {m.learnersTaught} learners</span>
      </div>
      {m.badges.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {m.badges.slice(0, 3).map((b) => <span key={b.key} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 9px", borderRadius: 999, background: "#FFF5E1", color: "#7A4F00", fontSize: 11.5, fontWeight: 800 }}><FiAward size={11} /> {b.label}</span>)}
        </div>
      )}
      <p style={{ margin: 0, fontSize: 12, color: "#6B7280" }}>{[m.courses.slice(0, 3).map((c) => c.course).join(", "), m.places.slice(0, 2).join(" · ")].filter(Boolean).join(" — ")}</p>
    </button>
  );
}

function AskDialog({ mentor, children, onClose }) {
  const ask = useRequestMentor();
  const [learnerId, setLearnerId] = useState(children[0]?.id || "");
  const [note, setNote] = useState("");
  return (
    <Modal
      title={`Ask for ${mentor.name}`}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="ci-btn" onClick={onClose} style={btn("secondary")}>Cancel</button>
          <button type="button" className="ci-btn" disabled={!learnerId || ask.isPending} onClick={() => ask.mutate({ teacherId: mentor.teacherId, learnerId, note }, { onSuccess: onClose })} style={btn("primary", { disabled: !learnerId || ask.isPending })}>{ask.isPending ? "Sending…" : "Send"}</button>
        </>
      )}
    >
      <CheckinStyles />
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "100%" }}>
        <p style={{ margin: 0, fontSize: 13, color: "#4B5563", lineHeight: 1.6 }}>We&apos;ll tell the team you&apos;d like {mentor.name.split(" ")[0]} to teach your child. They&apos;ll check the class times and places and be in touch.</p>
        <div>
          <label htmlFor="ask-child" style={label}>For</label>
          <select id="ask-child" value={learnerId} onChange={(e) => setLearnerId(e.target.value)} style={input}>
            {children.map((c) => <option key={c.id} value={c.id}>{[c.firstName, c.lastName].filter(Boolean).join(" ")}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ask-note" style={label}>Anything to add? <span style={{ fontWeight: 500, color: "#6B7280" }}>(optional)</span></label>
          <textarea id="ask-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} placeholder="e.g. Saturday mornings suit us best." style={{ ...input, resize: "vertical" }} />
        </div>
      </div>
    </Modal>
  );
}

export function MentorProfilePage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { children = [] } = useOutletContext() || {};
  const { data = [], isLoading } = useMentorDirectory();
  const [params, setParams] = useSearchParams();
  const [asking, setAsking] = useState(false);
  const mentor = data.find((m) => m.slug === slug);
  // The open tab lives in the address (?tab=), as on the educator's and the admin's pages.
  const setTab = (key) => {
    const next = new URLSearchParams(params);
    if (key === "overview") next.delete("tab"); else next.set("tab", key);
    setParams(next, { replace: true });
  };
  if (isLoading) return <div style={{ padding: "60px 20px", textAlign: "center", color: "#9CA3AF", fontFamily: "Inter, sans-serif" }}>Loading…</div>;
  if (!mentor) return <div style={{ padding: "50px 20px", textAlign: "center", fontFamily: "Inter, sans-serif" }}>This educator isn&apos;t listed. <Link to="/parent/mentors">Back to Find a mentor</Link></div>;
  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <PublicProfileView
        profile={mentor}
        crumb={{ label: "Find a mentor", onClick: () => navigate("/parent/mentors") }}
        tab={params.get("tab")}
        onTab={setTab}
        actions={children.length > 0 && (
          <>
            {/* A session with them now, for a child stuck on something (modules/mentor-bookings). */}
            <button type="button" onClick={() => navigate(`/parent/bookings/new?teacherId=${mentor.teacherId}`)} style={{ padding: "9px 16px", borderRadius: 10, border: "none", background: "#feb139", color: "#25476a", boxShadow: "0 2px 8px rgba(254,177,57,0.35)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              Book a session
            </button>
            {/* Ongoing: ask the team for them as the child's class mentor. */}
            <button type="button" onClick={() => setAsking(true)} style={{ padding: "9px 16px", borderRadius: 10, background: "rgba(255,255,255,0.14)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.35)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              Ask for {mentor.name.split(" ")[0]}
            </button>
          </>
        )}
      />
      {asking && <AskDialog mentor={mentor} children={children} onClose={() => setAsking(false)} />}
    </div>
  );
}

export default function FindMentorPage() {
  const navigate = useNavigate();
  const { data = [], isLoading } = useMentorDirectory();
  const [q, setQ] = useState("");
  const [place, setPlace] = useState("");
  const [online, setOnline] = useState(false);
  const places = useMemo(() => [...new Set(data.flatMap((m) => m.places))].sort(), [data]);
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return data.filter((m) => (!place || m.places.includes(place)) && (!online || m.teaches.online)
      && (!term || [m.name, m.headline, ...(m.specialties || []), ...m.courses.map((c) => c.course)].filter(Boolean).some((x) => x.toLowerCase().includes(term))));
  }, [data, q, place, online]);

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 45%, #2e7db5 100%)", borderRadius: 20, padding: "24px 28px", color: "#fff" }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 23, fontWeight: 900 }}>Find a mentor</h1>
        <p style={{ margin: 0, fontSize: 13.5, color: "rgba(255,255,255,0.8)", maxWidth: 640, lineHeight: 1.6 }}>Educators at your children&apos;s learning centres — their verified teaching, what parents say and their quality reviews. Found one you like? Ask for them.</p>
      </div>
      <div style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <label style={{ flex: "1 1 220px", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 9, border: "1.5px solid #E5E7EB", minWidth: 0 }}>
          <FiSearch color="#9CA3AF" />
          <input aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, course or subject…" style={{ border: "none", outline: "none", fontSize: 13.5, width: "100%", fontFamily: "inherit" }} />
        </label>
        {places.length > 1 && (
          <select aria-label="Place" value={place} onChange={(e) => setPlace(e.target.value)} style={{ padding: "9px 10px", borderRadius: 9, border: "1.5px solid #E5E7EB", fontSize: 13, fontFamily: "inherit" }}>
            <option value="">Everywhere</option>
            {places.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#374151", cursor: "pointer" }}><input type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} /> Teaches online</label>
        <span style={{ marginLeft: "auto", fontSize: 12.5, color: "#9CA3AF" }}>{isLoading ? "Loading…" : `${shown.length} educator${shown.length === 1 ? "" : "s"}`}</span>
      </div>
      {!isLoading && shown.length === 0 ? (
        <div style={{ padding: "50px 20px", textAlign: "center", background: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB" }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#374151" }}>{data.length ? "No educator matches" : "No educator profiles shared yet"}</p>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#9CA3AF" }}>{data.length ? "Try a different search." : "Educators appear here once they share their profile."}</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))" }}>
          {shown.map((m) => <MentorCard key={m.slug} m={m} onOpen={() => navigate(`/parent/mentors/${m.slug}`)} />)}
        </div>
      )}
    </div>
  );
}
