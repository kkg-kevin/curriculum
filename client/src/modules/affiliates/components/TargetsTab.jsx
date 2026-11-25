import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FiTarget, FiUsers } from "react-icons/fi";
import { Segmented } from "../../../components/ui/TabBar";
import { BRAND, FONT, card, cardHeading } from "../../../theme/brand";
import { affiliatesApi, errorOf, formatKsh } from "../services/affiliatesApi";
import { TargetBar, TargetPill, toGo } from "./TargetProgress";

// Affiliates → Targets (25 Nov 2026 — server: GET /api/affiliates/targets, affiliate.targets.js):
// every affiliate's month against their targets — money their families paid, families paying for
// the first time — with a manager's team below them. This month is live; a month that's over shows
// what was saved when it ended. Targets are set in Settings (everyone) or Edit (their own).

const th = { textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 800, color: BRAND.muted, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${BRAND.border}`, whiteSpace: "nowrap" };
const td = { padding: "12px", fontSize: 13, color: BRAND.inkSoft, borderBottom: `1px solid ${BRAND.line}`, verticalAlign: "top" };
const ORDER = { behind: 0, on_track: 1, missed: 2, met: 3, none: 4 };

function Tile({ label, value, note }) {
  return (
    <div style={{ ...card, padding: "14px 16px" }}>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: BRAND.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: BRAND.ink, marginTop: 4 }}>{value}</div>
      {note && <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 2 }}>{note}</div>}
    </div>
  );
}

function Standing({ s, team = false }) {
  return (
    <>
      <td style={{ ...td, minWidth: 200 }}><TargetBar kind="money" progress={s.money} compact /></td>
      <td style={{ ...td, minWidth: 180 }}>
        <TargetBar kind="families" progress={s.families} compact />
        {!team && s.onTheWay > 0 && <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 4 }}>+ {s.onTheWay} signed up, not paid yet</div>}
      </td>
      <td style={td}>
        <TargetPill state={s.state} />
        {["behind", "on_track"].includes(s.state) && toGo(s) && <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 4 }}>{toGo(s)}</div>}
      </td>
    </>
  );
}

export default function TargetsTab({ onOpenSettings }) {
  const [month, setMonth] = useState("");
  const [show, setShow] = useState("");
  const { data, isLoading, error } = useQuery({
    queryKey: ["affiliates", "targets", month || "now"],
    queryFn: () => affiliatesApi.targets(month || undefined),
  });
  const rows = useMemo(() => {
    const list = [...(data?.rows || [])].sort((a, b) => (ORDER[a.own.state] - ORDER[b.own.state]) || a.affiliate.name.localeCompare(b.affiliate.name));
    return show ? list.filter((r) => r.own.state === show) : list;
  }, [data, show]);

  if (isLoading) return <p style={{ color: BRAND.muted, fontFamily: FONT }}>Loading…</p>;
  if (error) return <p style={{ color: BRAND.danger, fontFamily: FONT }}>{errorOf(error)}</p>;
  const { summary, defaults } = data;
  const noTargets = summary.withTarget === 0;

  return (
    <div style={{ display: "grid", gap: 14, fontFamily: FONT }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 700, color: BRAND.inkSoft }}>
          Month
          <select value={month || data.month} onChange={(e) => setMonth(e.target.value === data.months[0].month ? "" : e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 9, border: `1.5px solid ${BRAND.border}`, fontSize: 13.5, fontFamily: FONT, color: BRAND.ink, background: "#fff" }}>
            {data.months.map((m, i) => <option key={m.month} value={m.month}>{m.label}{i === 0 ? " (this month)" : ""}</option>)}
          </select>
        </label>
        <span style={{ fontSize: 12.5, color: BRAND.muted }}>
          {data.current ? `${data.daysLeft} ${data.daysLeft === 1 ? "day" : "days"} left · the tick on each bar is where an even pace would be today` : data.saved ? "As it stood when the month ended" : "Worked out from the records now (this month wasn't saved when it ended)"}
        </span>
      </div>

      {noTargets && (
        <div style={{ padding: "12px 14px", borderRadius: 12, background: BRAND.goldTint, border: `1px solid ${BRAND.goldBorder}`, fontSize: 13, color: BRAND.goldText, lineHeight: 1.55 }}>
          <strong>No targets set{data.current ? "" : " that month"}.</strong> Set one for everyone in <button type="button" onClick={onOpenSettings} style={{ border: 0, background: "none", padding: 0, color: BRAND.navy, fontWeight: 800, cursor: "pointer", textDecoration: "underline", fontFamily: FONT, fontSize: 13 }}>Settings → Monthly targets</button>, or give someone their own in Edit → Targets. What each affiliate reached is shown below either way.
        </div>
      )}

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))" }}>
        <Tile label="Money brought in" value={formatKsh(summary.money)} note={defaults.money ? `Target each: ${formatKsh(defaults.money)}` : "No money target in Settings"} />
        <Tile label="Families paying" value={summary.families} note={summary.onTheWay ? `+ ${summary.onTheWay} signed up, not paid yet` : defaults.families ? `Target each: ${defaults.families}` : "No families target in Settings"} />
        <Tile label="Target met" value={`${summary.met} of ${summary.withTarget}`} note={summary.withTarget ? "affiliates with a target" : "no one has a target"} />
        {data.current
          ? <Tile label="Behind" value={summary.behind} note={`${summary.onTrack} on track`} />
          : <Tile label="Missed" value={summary.missed} />}
      </div>

      {!noTargets && (
        <Segmented label="Show" value={show} onChange={setShow}
          options={[
            { key: "", label: "Everyone" },
            ...(data.current ? [{ key: "behind", label: "Behind", count: summary.behind }, { key: "on_track", label: "On track", count: summary.onTrack }] : [{ key: "missed", label: "Missed", count: summary.missed }]),
            { key: "met", label: "Met", count: summary.met },
            { key: "none", label: "No target", count: summary.affiliates - summary.withTarget },
          ]} />
      )}

      <div style={{ ...card, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
          <thead><tr>{["Affiliate", "Money brought in", "Families paying", "Standing"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => [
              <tr key={r.affiliate.id}>
                <td style={td}>
                  <strong style={{ color: BRAND.ink }}>{r.affiliate.name}</strong>
                  <div style={{ fontSize: 12, color: BRAND.muted }}>
                    {r.affiliate.code && <code style={{ color: BRAND.navy }}>{r.affiliate.code}</code>}
                    {r.affiliate.status === "suspended" ? " · suspended" : ""}{r.own.ownTargets ? " · own targets" : ""}
                  </div>
                </td>
                <Standing s={r.own} />
              </tr>,
              r.team && (
                <tr key={`${r.affiliate.id}-team`} style={{ background: "#FBFCFE" }}>
                  <td style={{ ...td, paddingLeft: 26 }}>
                    <span style={{ ...cardHeading, color: BRAND.mid }}><FiUsers size={12} /> Their team</span>
                    <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 2 }}>{r.affiliate.name.split(" ")[0]} + {r.team.size} {r.team.size === 1 ? "affiliate" : "affiliates"}{r.team.ownTargets ? " · own team target" : " · target = everyone's added up"}</div>
                  </td>
                  <Standing s={r.team} team />
                </tr>
              ),
            ])}
          </tbody>
        </table>
        {rows.length === 0 && <p style={{ margin: 0, padding: "28px 16px", textAlign: "center", color: BRAND.muted, fontSize: 13.5 }}><FiTarget size={14} style={{ verticalAlign: "-2px" }} /> No one here.</p>}
      </div>
      <p style={{ margin: 0, fontSize: 12.5, color: BRAND.muted, lineHeight: 1.55 }}>
        Money brought in = every payment in the month on invoices of the families an affiliate referred (part payments too; invoice credit paid out to affiliates doesn&rsquo;t count). Families paying = families whose first invoice was paid in full in the month. Cancelled referrals don&rsquo;t count. Targets track progress only — reaching one earns nothing extra.
      </p>
    </div>
  );
}
