import { useEffect, useState } from "react";
import { FiBriefcase, FiHome, FiShield, FiSmile, FiUserCheck, FiUsers, FiGift } from "react-icons/fi";
import { BRAND, FONT } from "../../../theme/brand";

// Small shared pieces of the announcement screens (26 Nov 2026): the look of each group, a bar for
// "how many opened / confirmed", filter chips with counts, and a width hook. System colours only.

export const GROUP_LOOK = {
  educators: { label: "Educators", Icon: FiUserCheck },
  parents: { label: "Parents", Icon: FiUsers },
  learners: { label: "Learners", Icon: FiSmile },
  hubs: { label: "Hubs", Icon: FiHome },
  supervisors: { label: "Supervisors", Icon: FiShield },
  staff: { label: "Staff", Icon: FiBriefcase },
  affiliates: { label: "Affiliates", Icon: FiGift },
};

export function GroupTag({ group, count }) {
  const look = GROUP_LOOK[group] || { label: group, Icon: FiUsers };
  const { Icon } = look;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999, background: BRAND.skyTint, color: BRAND.navy, border: `1px solid ${BRAND.skyBorder}`, fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap" }}>
      <Icon size={11} /> {look.label}{count != null ? ` · ${count}` : ""}
    </span>
  );
}

export const pct = (n, of) => (of ? Math.round(((n || 0) / of) * 100) : 0);
export const people = (n) => `${n || 0} ${n === 1 ? "person" : "people"}`;

// A labelled bar: "Opened 62%".
export function Meter({ label, value, of, tone = "navy", compact = false }) {
  const p = pct(value, of);
  const color = tone === "gold" ? BRAND.gold : tone === "sky" ? BRAND.sky : BRAND.navy;
  return (
    <div style={{ display: "grid", gap: compact ? 3 : 5, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: compact ? 11.5 : 12.5, fontWeight: 700, color: BRAND.inkSoft }}>
        <span>{label}</span>
        <span style={{ color: BRAND.ink }}>{p}%{!compact && of ? <span style={{ fontWeight: 600, color: BRAND.muted }}> · {value || 0} of {of}</span> : null}</span>
      </div>
      <div role="progressbar" aria-label={label} aria-valuenow={p} aria-valuemin={0} aria-valuemax={100} style={{ height: compact ? 6 : 8, borderRadius: 999, background: BRAND.track || BRAND.greyTint, overflow: "hidden" }}>
        <div style={{ width: `${p}%`, height: "100%", borderRadius: 999, background: color, transition: "width 300ms ease" }} />
      </div>
    </div>
  );
}

// Filter chips with counts, scrolling sideways on a phone instead of wrapping into a wall.
export function FilterChips({ options, value, onChange, label }) {
  return (
    <div role="group" aria-label={label} style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" }}>
      {options.map(([key, text, n]) => {
        const on = value === key;
        return (
          <button key={key} type="button" aria-pressed={on} onClick={() => onChange(key)} style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 36, padding: "6px 13px", borderRadius: 999, border: `1.5px solid ${on ? BRAND.navy : BRAND.border}`, background: on ? BRAND.navy : "#fff", color: on ? "#fff" : BRAND.inkSoft, fontSize: 13, fontWeight: 700, fontFamily: FONT, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
            {text}{n ? <span style={{ padding: "0 7px", borderRadius: 999, background: on ? "rgba(255,255,255,0.22)" : BRAND.greyTint, fontSize: 12 }}>{n}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function useWide(min) {
  const [wide, setWide] = useState(() => (typeof window !== "undefined" ? window.innerWidth >= min : true));
  useEffect(() => {
    const on = () => setWide(window.innerWidth >= min);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [min]);
  return wide;
}
