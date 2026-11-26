import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiArrowLeft, FiCheckCircle, FiMessageSquare, FiPaperclip, FiVolume2 } from "react-icons/fi";
import { BRAND, FONT, HERO_GRADIENT, card, pill } from "../../../theme/brand";
import AnnouncementView from "../components/AnnouncementView";
import { FilterChips, useWide } from "../components/ui";
import { announcementsApi, day, errorOf } from "../services/announcementsApi";

// Announcements from the Digifunzi team (26 Nov 2026), in every portal at <portal>/announcements
// (and /announcements in the admin app for staff). An inbox: filter by All / Unread / To confirm,
// new ones marked with a dot; on a computer the list sits beside the open one (the first opens by
// itself), on a phone the list and the announcement are a page each.

function Skeleton({ rows = 3 }) {
  return (
    <div style={{ display: "grid", gap: 8 }} aria-busy="true" aria-label="Loading">
      <style>{"@keyframes annPulse { 0%,100% { opacity: .55 } 50% { opacity: 1 } }"}</style>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ ...card, padding: 15, display: "grid", gap: 8, animation: "annPulse 1.4s ease-in-out infinite" }}>
          <span style={{ height: 12, width: "40%", borderRadius: 6, background: BRAND.greyTint }} />
          <span style={{ height: 16, width: "80%", borderRadius: 6, background: BRAND.greyTint }} />
          <span style={{ height: 12, width: "60%", borderRadius: 6, background: BRAND.greyTint }} />
        </div>
      ))}
    </div>
  );
}

export function OpenAnnouncement({ id, onBack }) {
  const qc = useQueryClient();
  const key = ["announcements", "one", id];
  const { data: a, isLoading, error } = useQuery({ queryKey: key, queryFn: () => announcementsApi.get(id) });
  // Opening marks it read: the list's "New" and the unread count follow.
  useEffect(() => { if (a) qc.invalidateQueries({ queryKey: ["announcements", "mine"] }); }, [a?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const act = useMutation({
    mutationFn: ({ fn }) => fn(),
    onSuccess: (d, v) => { qc.setQueryData(key, d); qc.invalidateQueries({ queryKey: ["announcements", "mine"] }); if (v.ok) toast.success(v.ok); },
    onError: (err) => toast.error(errorOf(err)),
  });
  const back = onBack && <button type="button" onClick={onBack} style={{ justifySelf: "start", display: "inline-flex", alignItems: "center", gap: 6, minHeight: 40, padding: "8px 14px", borderRadius: 999, border: `1.5px solid ${BRAND.border}`, background: "#fff", fontWeight: 700, fontFamily: FONT, cursor: "pointer", color: BRAND.inkSoft }}><FiArrowLeft /> All announcements</button>;
  if (isLoading) return <div style={{ display: "grid", gap: 10 }}>{back}<Skeleton rows={1} /></div>;
  if (error) return <div style={{ display: "grid", gap: 10 }}>{back}<div style={{ ...card, padding: 24, color: BRAND.danger }}>{errorOf(error)}</div></div>;
  return (
    <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
      {back}
      <AnnouncementView
        a={a}
        busy={act.isPending}
        onAck={() => act.mutate({ fn: () => announcementsApi.ack(id), ok: "Thanks for confirming" })}
        onReact={(kind) => act.mutate({ fn: () => announcementsApi.react(id, kind) })}
        onComment={(body) => act.mutate({ fn: () => announcementsApi.comment(id, body) })}
        onDeleteComment={(cid) => act.mutate({ fn: () => announcementsApi.deleteComment(id, cid), ok: "Comment deleted" })}
      />
    </div>
  );
}

function Row({ a, on, to }) {
  const unread = !a.seen && a.state === "live";
  const toConfirm = a.askAck && !a.acked && a.state === "live";
  return (
    <Link to={to} aria-current={on ? "page" : undefined}
      style={{ ...card, padding: "13px 15px 13px 13px", textDecoration: "none", display: "flex", gap: 11, borderColor: on ? BRAND.navy : BRAND.border, background: on ? BRAND.navyTint : "#fff", opacity: a.state === "ended" ? 0.72 : 1 }}>
      <span aria-hidden style={{ width: 10, flexShrink: 0, paddingTop: 6 }}>{unread && <span style={{ display: "block", width: 9, height: 9, borderRadius: "50%", background: BRAND.gold }} />}</span>
      <span style={{ minWidth: 0, flex: 1, display: "grid", gap: 4 }}>
        <span style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
          <strong style={{ flex: 1, minWidth: 0, fontSize: 14.5, color: BRAND.ink, lineHeight: 1.3, fontWeight: unread ? 900 : 700 }}>{a.title}</strong>
          <span style={{ fontSize: 11.5, color: BRAND.faint, whiteSpace: "nowrap" }}>{day(a.publishedAt)}</span>
        </span>
        {a.summary && <span style={{ fontSize: 13, color: BRAND.inkSoft, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.45 }}>{a.summary}</span>}
        <span style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
          {a.important && <span style={pill("waiting")}>Important</span>}
          {a.pinned && <span style={pill("info")}>Pinned</span>}
          {toConfirm && <span style={pill("strong")}><FiCheckCircle size={11} /> Please confirm</span>}
          {a.acked && <span style={pill("good")}><FiCheckCircle size={11} /> Confirmed</span>}
          {a.allowComments && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, color: BRAND.muted }}><FiMessageSquare size={11} /> Comments open</span>}
          {a.state === "ended" && <span style={pill("neutral")}>Ended</span>}
        </span>
      </span>
    </Link>
  );
}

export default function AnnouncementsPage() {
  const { id } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const wide = useWide(1000);
  const [filter, setFilter] = useState("all");
  const base = `${pathname.split("/announcements")[0]}/announcements`;
  const { data, isLoading, error } = useQuery({ queryKey: ["announcements", "mine"], queryFn: announcementsApi.mine });
  const list = data?.announcements || [];
  const isUnread = (a) => !a.seen && a.state === "live";
  const isToConfirm = (a) => a.askAck && !a.acked && a.state === "live";
  const shown = useMemo(() => list.filter((a) => (filter === "unread" ? isUnread(a) : filter === "confirm" ? isToConfirm(a) : true)), [list, filter]);
  const unread = list.filter(isUnread).length;
  const toConfirm = list.filter(isToConfirm).length;

  // On a computer, open the first one (an unread one if there is) rather than an empty panel.
  useEffect(() => {
    if (!wide || id || !list.length) return;
    const first = list.find(isUnread) || list[0];
    navigate(`${base}/${first.id}`, { replace: true });
  }, [wide, id, list.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const listView = (
    <div style={{ display: "grid", gap: 10, alignContent: "start", minWidth: 0 }}>
      {list.length > 0 && <FilterChips label="Show" value={filter} onChange={setFilter} options={[["all", "All", list.length], ["unread", "Unread", unread], ["confirm", "To confirm", toConfirm]]} />}
      {isLoading && <Skeleton />}
      {error && <div style={{ ...card, padding: 24, color: BRAND.danger }}>{errorOf(error)}</div>}
      {!isLoading && !error && !list.length && (
        <div style={{ ...card, padding: "40px 22px", textAlign: "center", display: "grid", gap: 6, justifyItems: "center" }}>
          <span aria-hidden style={{ width: 56, height: 56, borderRadius: 16, background: BRAND.skyTint, color: BRAND.navy, display: "grid", placeItems: "center" }}><FiVolume2 size={24} /></span>
          <p style={{ margin: "6px 0 0", fontWeight: 900, fontSize: 16, color: BRAND.ink }}>You&apos;re all caught up</p>
          <p style={{ margin: 0, fontSize: 13.5, color: BRAND.muted, maxWidth: 340 }}>When the Digifunzi team posts something for you, it shows up here and in your notifications.</p>
        </div>
      )}
      {!isLoading && list.length > 0 && !shown.length && <div style={{ ...card, padding: "24px 18px", textAlign: "center", color: BRAND.muted, fontSize: 13.5 }}>{filter === "unread" ? "Nothing unread." : "Nothing waiting for you to confirm."}</div>}
      {shown.map((a) => <Row key={a.id} a={a} on={a.id === id} to={`${base}/${a.id}`} />)}
    </div>
  );

  return (
    <div style={{ display: "grid", gap: 14, fontFamily: FONT, width: "100%" }}>
      <header style={{ background: HERO_GRADIENT, color: "#fff", borderRadius: 20, padding: wide ? "20px 24px" : "16px 18px", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <span aria-hidden style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(255,255,255,0.16)", display: "grid", placeItems: "center", flexShrink: 0 }}><FiVolume2 size={22} /></span>
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: BRAND.gold }}>From the Digifunzi team</div>
          <h1 style={{ margin: "2px 0", fontSize: wide ? 24 : 20, fontWeight: 900 }}>Announcements</h1>
          <div style={{ fontSize: 13.5, opacity: 0.92 }}>
            {unread || toConfirm ? [unread ? `${unread} unread` : null, toConfirm ? `${toConfirm} waiting for you to confirm` : null].filter(Boolean).join(" · ") : "News and notices for you."}
          </div>
        </div>
      </header>
      {wide ? (
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(300px, 0.85fr) minmax(0, 1.5fr)", alignItems: "start" }}>
          <div style={{ position: "sticky", top: 12, maxHeight: "calc(100vh - 140px)", overflowY: "auto", paddingRight: 2 }}>{listView}</div>
          {id ? <OpenAnnouncement key={id} id={id} /> : <div style={{ ...card, padding: "48px 20px", textAlign: "center", color: BRAND.muted }}>{isLoading ? "" : list.length ? "Choose an announcement to read it." : <><FiPaperclip /> Nothing here yet.</>}</div>}
        </div>
      ) : id ? <OpenAnnouncement key={id} id={id} onBack={() => navigate(base)} /> : listView}
    </div>
  );
}
