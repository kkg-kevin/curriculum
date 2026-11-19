import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { FiCreditCard } from "react-icons/fi";
import { askConfirm, askText } from "../../../components/ui/AskDialog";
import { btn } from "../../qa/shared";
import { BRAND, FONT, HERO_GRADIENT, card, cardHeading } from "../../../theme/brand";
import { useCancelCover, useCoverEarnings, useMyCovers, useRespondCover } from "../hooks/useCovers";
import { ClaimCoversDialog, CoverRow, ksh } from "../shared";

/*
 * Teacher portal → Covers (/teacher-portal/covers, 19 Nov 2026): covering for other educators and
 * being covered.
 *   Asked of you      accept or decline
 *   You're covering   open the cover page (plan, attendance, Mark as taught), or pull out
 *   Your sessions     covers of your classes' sessions — cancel one
 *   To claim          pay for sessions you covered, claimed with an eTIMS invoice
 * Ask for a cover from the session itself on your Timetable.
 */
const today = () => dayjs().format("YYYY-MM-DD");
const section = (title, note) => (
  <div>
    <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: BRAND.ink }}>{title}</h2>
    {note && <p style={{ margin: "2px 0 0", fontSize: 12.5, color: BRAND.muted }}>{note}</p>}
  </div>
);
const list = { display: "grid", gap: 8, gridTemplateColumns: "100%" };

export default function CoversPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useMyCovers();
  const { data: earnings } = useCoverEarnings();
  const respond = useRespondCover();
  const cancel = useCancelCover();
  const [claiming, setClaiming] = useState(null);
  const forMe = data?.forMe || [];
  const forMyClasses = data?.forMyClasses || [];
  const asked = forMe.filter((c) => c.status === "pending");
  const covering = forMe.filter((c) => c.status === "accepted" && c.date >= dayjs().subtract(2, "day").format("YYYY-MM-DD"));
  const mine = forMyClasses.filter((c) => ["pending", "accepted"].includes(c.status) && c.date >= today());
  const shownIds = new Set([...asked, ...covering, ...mine].map((c) => c.id));
  const past = [...forMe, ...forMyClasses].filter((c) => !shownIds.has(c.id)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);
  const groups = earnings?.groups || [];

  const decline = async (cover) => {
    const reason = await askText({ title: "Decline this cover?", label: "Why? They see this.", confirmLabel: "Decline" });
    if (reason === null || reason === undefined) return;
    respond.mutate({ id: cover.id, decision: "decline", reason: reason || null });
  };
  const pullOut = async (cover) => {
    const reason = await askText({ title: "Pull out of this cover?", label: "Why? They are told straight away.", confirmLabel: "Pull out" });
    if (reason === null || reason === undefined) return;
    cancel.mutate({ id: cover.id, reason: reason || null });
  };
  const cancelMine = async (cover) => {
    const ok = await askConfirm({ title: `Cancel ${cover.coverTeacherName}'s cover?`, message: "They'll be told, and the session is yours to teach again.", confirmLabel: "Cancel cover", tone: "danger" });
    if (ok) cancel.mutate({ id: cover.id, reason: null });
  };

  return (
    <div style={{ fontFamily: FONT, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: HERO_GRADIENT, borderRadius: 20, padding: "24px 28px", color: "#fff" }}>
        <h1 style={{ margin: 0, fontSize: 23, fontWeight: 900 }}>Covers</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "rgba(255,255,255,0.82)", maxWidth: 660, lineHeight: 1.6 }}>
          Teaching another educator&apos;s session, or someone teaching yours. To ask for cover, open the session on your <Link to="/teacher-portal/timetable" style={{ color: "#fff", fontWeight: 700 }}>Timetable</Link> and choose &ldquo;Ask someone to cover&rdquo;.
        </p>
      </div>

      {groups.length > 0 && (
        <section style={{ ...card, padding: "16px 18px", border: `1px solid ${BRAND.skyBorder}` }}>
          <h2 style={{ ...cardHeading, marginBottom: 10 }}><FiCreditCard size={12} /> To claim</h2>
          {groups.map((g) => (
            <div key={g.ownerAdminId} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <p style={{ margin: 0, flex: "1 1 220px", fontSize: 14, color: BRAND.ink }}><strong style={{ fontSize: 18 }}>{ksh(g.amount)}</strong> for {g.count} session{g.count === 1 ? "" : "s"} you covered</p>
              <button type="button" className="ci-btn" onClick={() => setClaiming(g)} style={btn("primary")}>Claim it</button>
            </div>
          ))}
        </section>
      )}
      {earnings?.fullTime && <p style={{ margin: 0, fontSize: 12.5, color: BRAND.muted }}>You&apos;re full time, so covering is part of your salary — nothing to claim.</p>}
      {earnings?.unpriced?.length > 0 && <p style={{ margin: 0, fontSize: 12.5, color: BRAND.goldText }}>{earnings.unpriced.length} covered session{earnings.unpriced.length === 1 ? " has" : "s have"} no rate for how you&apos;re paid yet — ask the admin to set it in Settings → Educator pay.</p>}

      {isLoading ? <p style={{ margin: 0, fontSize: 13, color: BRAND.faint }}>Loading…</p>
        : isError ? <p style={{ margin: 0, fontSize: 13, color: BRAND.danger }}>Couldn&apos;t load your covers — try refreshing.</p>
          : (
            <>
              {asked.length > 0 && (
                <>
                  {section("Asked of you", "Accepting puts the session on your timetable. Families are told the day before.")}
                  <div style={list}>
                    {asked.map((c) => (
                      <CoverRow key={c.id} cover={c} perspective="cover" actions={(
                        <span style={{ display: "inline-flex", gap: 8 }}>
                          <button type="button" className="ci-btn" disabled={respond.isPending} onClick={() => decline(c)} style={btn("secondary")}>Decline</button>
                          <button type="button" className="ci-btn" disabled={respond.isPending} onClick={() => respond.mutate({ id: c.id, decision: "accept" })} style={btn("primary")}>Accept</button>
                        </span>
                      )} />
                    ))}
                  </div>
                </>
              )}

              {section("You're covering", covering.length ? null : "Nothing coming up.")}
              {covering.length > 0 && (
                <div style={list}>
                  {covering.map((c) => (
                    <CoverRow key={c.id} cover={c} perspective="cover" actions={(
                      <span style={{ display: "inline-flex", gap: 8 }}>
                        {c.date >= today() && <button type="button" className="ci-btn" disabled={cancel.isPending} onClick={() => pullOut(c)} style={btn("secondary")}>Pull out</button>}
                        <button type="button" className="ci-btn" onClick={() => navigate(`/teacher-portal/covers/${c.id}`)} style={btn("primary")}>Open</button>
                      </span>
                    )} />
                  ))}
                </div>
              )}

              {section("Your sessions being covered", mine.length ? null : "None coming up.")}
              {mine.length > 0 && (
                <div style={list}>
                  {mine.map((c) => (
                    <CoverRow key={c.id} cover={c} perspective="class" actions={(
                      <button type="button" className="ci-btn" disabled={cancel.isPending} onClick={() => cancelMine(c)} style={btn("secondary")}>{c.status === "pending" ? "Withdraw" : "Cancel"}</button>
                    )} />
                  ))}
                </div>
              )}

              {past.length > 0 && (
                <>
                  {section("Earlier")}
                  <div style={list}>
                    {past.map((c) => (
                      <CoverRow key={c.id} cover={c} perspective={forMe.some((x) => x.id === c.id) ? "cover" : "class"} actions={c.status === "accepted" && forMe.some((x) => x.id === c.id)
                        ? <button type="button" className="ci-btn" onClick={() => navigate(`/teacher-portal/covers/${c.id}`)} style={btn("secondary")}>Open</button> : null} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
      {claiming && <ClaimCoversDialog group={claiming} onClose={() => setClaiming(null)} />}
    </div>
  );
}
