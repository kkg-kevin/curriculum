import { useMemo, useState } from "react";
import dayjs from "dayjs";
import { askConfirm } from "../../../components/ui/AskDialog";
import { btn, Segmented } from "../../qa/shared";
import { BRAND, FONT, HERO_GRADIENT } from "../../../theme/brand";
import { useCancelCover, useCoversOverview } from "../hooks/useCovers";
import { CoverRow } from "../shared";

/*
 * Covers overview (19 Nov 2026) — the admin's (/covers) and a hub's (/school-portal/covers): every
 * cover at their hubs — coming up, waiting for an answer, and past — who covered whom. Arrange a
 * cover from a session on the Timetable's calendar.
 */
const VIEWS = [
  { key: "upcoming", label: "Coming up" },
  { key: "waiting", label: "Waiting for an answer" },
  { key: "past", label: "Past and closed" },
];

export default function CoversOverviewPage() {
  const { data: covers = [], isLoading, isError } = useCoversOverview();
  const cancel = useCancelCover();
  const [view, setView] = useState("upcoming");
  const today = dayjs().format("YYYY-MM-DD");
  const buckets = useMemo(() => ({
    upcoming: covers.filter((c) => c.status === "accepted" && c.date >= today).sort((a, b) => a.date.localeCompare(b.date)),
    waiting: covers.filter((c) => c.status === "pending").sort((a, b) => a.date.localeCompare(b.date)),
    past: covers.filter((c) => !(c.status === "pending" || (c.status === "accepted" && c.date >= today))),
  }), [covers, today]);
  const shown = buckets[view];

  const cancelCover = async (cover) => {
    const ok = await askConfirm({ title: `Cancel ${cover.coverTeacherName}'s cover?`, message: "They and the class's educator are told.", confirmLabel: "Cancel cover", tone: "danger" });
    if (ok) cancel.mutate({ id: cover.id, reason: null });
  };

  return (
    <div style={{ fontFamily: FONT, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: HERO_GRADIENT, borderRadius: 20, padding: "24px 28px", color: "#fff" }}>
        <h1 style={{ margin: 0, fontSize: 23, fontWeight: 900 }}>Covers</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "rgba(255,255,255,0.82)", maxWidth: 680, lineHeight: 1.6 }}>
          Sessions taught by another educator in place of the class&apos;s own. To arrange one, open the session on the Timetable&apos;s calendar and choose &ldquo;Ask someone to cover&rdquo;.
        </p>
      </div>
      <Segmented options={VIEWS.map((v) => ({ ...v, count: buckets[v.key].length }))} value={view} onChange={setView} label="Which covers" />
      {isLoading ? <p style={{ margin: 0, fontSize: 13, color: BRAND.faint }}>Loading…</p>
        : isError ? <p style={{ margin: 0, fontSize: 13, color: BRAND.danger }}>Couldn&apos;t load covers — try refreshing.</p>
          : shown.length === 0 ? <p style={{ margin: 0, fontSize: 13, color: BRAND.muted }}>Nothing here.</p>
            : (
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "100%" }}>
                {shown.map((c) => (
                  <CoverRow key={c.id} cover={c} perspective="both" actions={["pending", "accepted"].includes(c.status) && c.date >= today
                    ? <button type="button" className="ci-btn" disabled={cancel.isPending} onClick={() => cancelCover(c)} style={btn("secondary")}>Cancel</button> : null} />
                ))}
              </div>
            )}
    </div>
  );
}
