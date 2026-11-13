import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiAlertTriangle, FiArchive, FiArrowRight, FiCheck, FiCheckCircle, FiExternalLink, FiPower, FiRepeat, FiTrash2, FiX, FiZap } from "react-icons/fi";
import { BRAND, FONT, pill } from "../../../theme/brand";
import { askConfirm } from "../../../components/ui/AskDialog";
import { removalApi } from "../services/removalApi";

// Removing a person, the one way for educators, learning hubs, supervisors and affiliates
// (server modules/removals/): 1 Deactivate → 2 Hand over their work to someone of the same role
// (one person for everything, any item to someone else) → 3 Delete. History about them stays under
// their name. The server says where they are (plan.step) — this only shows it and acts.

const WORDS = {
  teacher: { one: "educator", the: "the educator", another: "another educator" },
  hub: { one: "learning hub", the: "the hub", another: "another hub" },
  supervisor: { one: "supervisor", the: "the supervisor", another: "another supervisor" },
  affiliate: { one: "affiliate", the: "the affiliate", another: "another affiliate" },
};
const DEACTIVATE_LABEL = { teacher: "Deactivate", hub: "Deactivate", supervisor: "Deactivate", affiliate: "Suspend" };
const STEPS = [
  { key: "deactivate", label: "Deactivate", icon: FiPower },
  { key: "transfer", label: "Hand over", icon: FiRepeat },
  { key: "delete", label: "Delete", icon: FiTrash2 },
];
const SAME = "";       // an item following "Give everything to"
const CANCEL = "cancel";
const NOBODY = "none";

export default function RemovePersonDialog({ open, kind, id, name, onClose, onRemoved }) {
  const words = WORDS[kind] || WORDS.teacher;
  const queryClient = useQueryClient();
  const planQuery = useQuery({
    queryKey: ["removal", kind, id],
    queryFn: () => removalApi.plan(kind, id),
    enabled: Boolean(open && id),
    staleTime: 0,
  });
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  const [to, setTo] = useState("");
  const [overrides, setOverrides] = useState({});
  const [failed, setFailed] = useState({}); // itemKey → why it didn't go

  useEffect(() => { if (planQuery.data) setPlan(planQuery.data); }, [planQuery.data]);
  useEffect(() => {
    if (!open) { setPlan(null); setTo(""); setOverrides({}); setFailed({}); }
  }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape" && !busy) onClose?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  const groups = useMemo(() => {
    const out = new Map();
    for (const item of plan?.items || []) {
      if (!out.has(item.group)) out.set(item.group, []);
      out.get(item.group).push(item);
    }
    return [...out.entries()];
  }, [plan]);

  if (!open) return null;

  const run = async (fn, { success } = {}) => {
    setBusy(true);
    try {
      const next = await fn();
      if (next) setPlan(next);
      if (success) toast.success(success);
      return next;
    } catch (err) {
      toast.error(err.message || "Something went wrong");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const deactivate = () => run(() => removalApi.deactivate(kind, id), { success: `${name || "They"} ${kind === "affiliate" ? "suspended" : "deactivated"}` })
    .then(() => queryClient.invalidateQueries());

  const handOver = async () => {
    const body = { to: to || null, overrides: Object.fromEntries(Object.entries(overrides).filter(([, v]) => v !== SAME)) };
    const next = await run(() => removalApi.transfer(kind, id, body));
    if (!next) return;
    const results = next.results || [];
    setFailed(Object.fromEntries(results.filter((r) => !r.ok).map((r) => [r.key, r.message])));
    const moved = results.filter((r) => r.ok).length;
    const notMoved = results.length - moved;
    if (moved) toast.success(`${moved} handed over${notMoved ? ` — ${notMoved} couldn't go, see why below` : ""}`);
    else if (notMoved) toast.error(`Nothing could go — see why below`);
    else toast("Choose who each thing goes to first");
    setOverrides((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => (next.items || []).some((i) => i.key === key))));
    queryClient.invalidateQueries();
  };

  const remove = async () => {
    const kept = plan?.history?.length;
    const ok = await askConfirm({
      title: `Delete ${name || words.the}?`,
      message: kept
        ? `${name || "They"} will be gone from every list and can't sign in as ${words.one === "learning hub" ? "this hub" : `a ${words.one}`}. What's kept under their name stays: ${plan.history.join(", ")}.`
        : `${name || "They"} will be deleted. This can't be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    const done = await run(() => removalApi.remove(kind, id), { success: `${name || "Removed"} — removed` });
    if (done) {
      queryClient.invalidateQueries();
      onRemoved?.(done);
    }
  };

  const step = plan?.step;
  const stepIndex = Math.max(0, STEPS.findIndex((s) => s.key === step));
  const candidates = plan?.candidates || [];
  const pendingChoices = (plan?.items || []).filter((item) => (overrides[item.key] ?? SAME) !== SAME || to).length;

  return createPortal(
    <div role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose?.(); }}
      style={{ position: "fixed", inset: 0, zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(17,32,51,0.45)", backdropFilter: "blur(3px)", fontFamily: FONT }}>
      <style>{`
        .rm-btn { transition: background-color .15s ease, border-color .15s ease; }
        .rm-btn:focus-visible, .rm-select:focus-visible, .rm-x:focus-visible { outline: 3px solid ${BRAND.sky}; outline-offset: 2px; }
        .rm-ghost:hover { background: ${BRAND.canvas} !important; }
        .rm-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(180px, 240px); gap: 10px; align-items: center; }
        @media (max-width: 560px) {
          .rm-row { grid-template-columns: 1fr; }
          .rm-actions { flex-direction: column-reverse; }
          .rm-actions > * { width: 100%; }
          .rm-steps span.rm-step-label { display: none; }
        }
      `}</style>
      <div role="dialog" aria-modal="true" aria-labelledby="rm-title"
        style={{ position: "relative", width: "100%", maxWidth: 760, maxHeight: "calc(100vh - 32px)", display: "flex", flexDirection: "column", background: BRAND.surface, borderRadius: 18, overflow: "hidden", boxShadow: "0 24px 64px rgba(17,32,51,0.28)" }}>
        <div aria-hidden="true" style={{ height: 5, flexShrink: 0, background: `linear-gradient(90deg, ${BRAND.navy}, ${BRAND.mid} 55%, ${BRAND.sky})` }} />
        <button type="button" aria-label="Close" className="rm-x" onClick={() => !busy && onClose?.()}
          style={{ position: "absolute", top: 14, right: 12, width: 32, height: 32, display: "grid", placeItems: "center", border: "none", borderRadius: 10, background: "transparent", color: BRAND.faint, cursor: "pointer" }}>
          <FiX size={18} />
        </button>

        <div style={{ padding: "20px 24px 12px", borderBottom: `1px solid ${BRAND.line}`, flexShrink: 0 }}>
          <h2 id="rm-title" style={{ margin: "0 36px 4px 0", fontSize: 18, fontWeight: 800, color: BRAND.ink }}>Remove {name || words.the}</h2>
          <p style={{ margin: 0, fontSize: 13, color: BRAND.muted, lineHeight: 1.5 }}>
            First switch them off, then hand what they still look after to {words.another}, then delete. Their history stays under their name.
          </p>
          <ol className="rm-steps" style={{ listStyle: "none", margin: "14px 0 0", padding: 0, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {STEPS.map((s, i) => {
              const done = step === "done" || i < stepIndex;
              const current = step !== "done" && i === stepIndex;
              const Icon = done ? FiCheck : s.icon;
              return (
                <li key={s.key} aria-current={current ? "step" : undefined}
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px 6px 7px", borderRadius: 999, fontSize: 12.5, fontWeight: 800,
                    background: current ? BRAND.navy : done ? BRAND.skyTint : BRAND.greyTint, color: current ? "#fff" : done ? BRAND.navy : BRAND.greyText,
                    border: `1px solid ${current ? BRAND.navy : done ? BRAND.skyBorder : BRAND.border}` }}>
                  <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: 999, display: "grid", placeItems: "center", background: current ? "rgba(255,255,255,0.18)" : "#fff" }}><Icon size={12} /></span>
                  <span>{i + 1}</span><span className="rm-step-label">{s.label}</span>
                </li>
              );
            })}
          </ol>
        </div>

        <div style={{ padding: "16px 24px", overflowY: "auto", flex: 1 }}>
          {!plan && planQuery.isLoading && <p style={{ color: BRAND.muted, fontSize: 14 }}>Working out what they hold…</p>}
          {!plan && planQuery.isError && <Notice tone="danger">{planQuery.error?.message || "Couldn't load this."}</Notice>}

          {plan && step === "deactivate" && (
            <>
              <Notice tone="info" icon={FiPower}>{plan.person.deactivateNote || `Deactivating stops them signing in as ${words.one === "learning hub" ? "the hub" : `an ${words.one}`} and being given anything new, while their work is handed over.`}</Notice>
              <Summary plan={plan} words={words} />
            </>
          )}

          {plan && step === "transfer" && (
            <>
              {plan.items.length > 0 && (
                <>
                  {candidates.length === 0 ? (
                    <Notice tone="waiting">There's nobody else to give it to yet — add {words.another} first (or switch one back on), then come back.</Notice>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12, background: BRAND.canvas, border: `1px solid ${BRAND.border}`, marginBottom: 14 }}>
                      <label htmlFor="rm-to" style={{ fontSize: 13.5, fontWeight: 800, color: BRAND.ink }}>Give everything to</label>
                      <select id="rm-to" className="rm-select" value={to} onChange={(e) => setTo(e.target.value)} style={selectStyle({ minWidth: 220, flex: "1 1 220px" })}>
                        <option value="">Choose {words.another}…</option>
                        {candidates.map((c) => <option key={c.id} value={c.id}>{c.name}{c.detail ? ` — ${c.detail}` : ""}</option>)}
                      </select>
                      <span style={{ fontSize: 12, color: BRAND.muted, flexBasis: "100%" }}>Anything below can go to someone else instead.</span>
                    </div>
                  )}
                  {groups.map(([group, items]) => (
                    <section key={group} style={{ marginBottom: 14 }}>
                      <h3 style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 800, color: BRAND.sky, textTransform: "uppercase", letterSpacing: "0.07em" }}>{group} · {items.length}</h3>
                      <div style={{ border: `1px solid ${BRAND.border}`, borderRadius: 12, overflow: "hidden" }}>
                        {items.map((item, i) => (
                          <div key={item.key} className="rm-row" style={{ padding: "10px 12px", borderTop: i ? `1px solid ${BRAND.line}` : "none", background: failed[item.key] ? BRAND.dangerTint : BRAND.surface }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13.5, fontWeight: 700, color: BRAND.ink, overflowWrap: "anywhere" }}>{item.label}</div>
                              {item.detail && <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 2 }}>{item.detail}</div>}
                              {failed[item.key] && <div role="alert" style={{ fontSize: 12, color: BRAND.danger, marginTop: 4, fontWeight: 600 }}>{failed[item.key]}</div>}
                            </div>
                            <select aria-label={`Who ${item.label} goes to`} className="rm-select" value={overrides[item.key] ?? SAME}
                              onChange={(e) => setOverrides((prev) => ({ ...prev, [item.key]: e.target.value }))} disabled={!candidates.length && !item.canCancel && !item.allowNone}
                              style={selectStyle({ width: "100%" })}>
                              <option value={SAME}>{to ? `Same: ${candidates.find((c) => c.id === to)?.name || "chosen above"}` : "Choose…"}</option>
                              {candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                              {item.canCancel && <option value={CANCEL}>Cancel it (refund due)</option>}
                              {item.allowNone && <option value={NOBODY}>Nobody</option>}
                            </select>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </>
              )}
              {plan.toSettle.length > 0 && (
                <section style={{ marginBottom: 14 }}>
                  <h3 style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 800, color: BRAND.goldText, textTransform: "uppercase", letterSpacing: "0.07em" }}>Sort these out first</h3>
                  {plan.toSettle.map((s) => (
                    <div key={s.label} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: 12, background: BRAND.goldTint, border: `1px solid ${BRAND.goldBorder}`, marginBottom: 6 }}>
                      <FiAlertTriangle size={16} color={BRAND.goldText} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: BRAND.ink }}>{s.label}</div>
                        {s.detail && <div style={{ fontSize: 12.5, color: BRAND.inkSoft, marginTop: 2 }}>{s.detail}</div>}
                      </div>
                      {s.href && <Link to={s.href} onClick={onClose} style={{ fontSize: 12.5, fontWeight: 800, color: BRAND.navy, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4 }}>Open <FiExternalLink size={12} /></Link>}
                    </div>
                  ))}
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: BRAND.muted }}>Come back here once they're done — this list updates by itself.</p>
                </section>
              )}
              <Lists plan={plan} />
            </>
          )}

          {plan && step === "delete" && (
            <>
              <Notice tone="good" icon={FiCheckCircle}>Nothing is left with them — they can be deleted.</Notice>
              <Lists plan={plan} />
            </>
          )}

          {plan && step === "done" && <Notice tone="neutral" icon={FiArchive}>Removed. Their history is kept under their name.</Notice>}
        </div>

        <div className="rm-actions" style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 24px", borderTop: `1px solid ${BRAND.line}`, flexShrink: 0, background: BRAND.surface }}>
          <button type="button" className="rm-btn rm-ghost" onClick={onClose} disabled={busy} style={buttonStyle("ghost")}>{step === "done" ? "Close" : "Not now"}</button>
          {step === "deactivate" && (
            <button type="button" className="rm-btn" onClick={deactivate} disabled={busy} style={buttonStyle("primary")}><FiPower size={15} /> {DEACTIVATE_LABEL[kind] || "Deactivate"}</button>
          )}
          {step === "transfer" && plan.items.length > 0 && (
            <button type="button" className="rm-btn" onClick={handOver} disabled={busy || !pendingChoices} style={buttonStyle("primary", !pendingChoices)}><FiArrowRight size={15} /> Hand over{pendingChoices ? ` ${pendingChoices}` : ""}</button>
          )}
          {step === "transfer" && plan.items.length === 0 && (
            <button type="button" className="rm-btn" onClick={() => planQuery.refetch()} disabled={busy || planQuery.isFetching} style={buttonStyle("primary")}><FiRepeat size={15} /> Check again</button>
          )}
          {step === "delete" && (
            <button type="button" className="rm-btn" onClick={remove} disabled={busy} style={buttonStyle("danger")}><FiTrash2 size={15} /> Delete {name || words.the}</button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Summary({ plan, words }) {
  const counts = new Map();
  for (const item of plan.items) counts.set(item.group, (counts.get(item.group) || 0) + 1);
  return (
    <>
      {counts.size > 0 ? (
        <section style={{ marginTop: 14 }}>
          <h3 style={headingStyle}>Still with them — handed over next</h3>
          <ul style={listStyle}>{[...counts.entries()].map(([group, n]) => <li key={group}><strong>{n}</strong> · {group}</li>)}</ul>
        </section>
      ) : (
        <p style={{ fontSize: 13.5, color: BRAND.inkSoft, marginTop: 14 }}>Nothing to hand over — once switched off, {words.the} can be deleted straight away.</p>
      )}
      {plan.toSettle.length > 0 && (
        <section style={{ marginTop: 12 }}>
          <h3 style={{ ...headingStyle, color: BRAND.goldText }}>To sort out before deleting</h3>
          <ul style={listStyle}>{plan.toSettle.map((s) => <li key={s.label}>{s.label}</li>)}</ul>
        </section>
      )}
      <Lists plan={plan} />
    </>
  );
}

function Lists({ plan }) {
  return (
    <>
      {plan.automatic?.length > 0 && (
        <section style={{ marginTop: 12 }}>
          <h3 style={headingStyle}><FiZap size={12} aria-hidden="true" /> Happens by itself when deleted</h3>
          <ul style={listStyle}>{plan.automatic.map((line) => <li key={line}>{line}</li>)}</ul>
        </section>
      )}
      {plan.history?.length > 0 && (
        <section style={{ marginTop: 12 }}>
          <h3 style={headingStyle}><FiArchive size={12} aria-hidden="true" /> Kept under their name</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{plan.history.map((line) => <span key={line} style={pill("neutral")}>{line}</span>)}</div>
        </section>
      )}
    </>
  );
}

function Notice({ tone = "info", icon: Icon = FiAlertTriangle, children }) {
  const colours = {
    info: [BRAND.skyTint, BRAND.skyBorder, BRAND.navy],
    good: [BRAND.skyTint, BRAND.skyBorder, BRAND.navy],
    waiting: [BRAND.goldTint, BRAND.goldBorder, BRAND.goldText],
    neutral: [BRAND.greyTint, BRAND.border, BRAND.greyText],
    danger: [BRAND.dangerTint, BRAND.dangerBorder, BRAND.danger],
  }[tone];
  return (
    <div role={tone === "danger" ? "alert" : undefined} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "11px 13px", borderRadius: 12, background: colours[0], border: `1px solid ${colours[1]}`, color: colours[2], fontSize: 13.5, lineHeight: 1.5, marginBottom: 12 }}>
      <Icon size={16} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

const headingStyle = { margin: "0 0 6px", fontSize: 11, fontWeight: 800, color: BRAND.sky, textTransform: "uppercase", letterSpacing: "0.07em", display: "flex", alignItems: "center", gap: 6 };
const listStyle = { margin: 0, paddingLeft: 18, fontSize: 13.5, color: BRAND.inkSoft, lineHeight: 1.7 };

function selectStyle(extra = {}) {
  return { padding: "8px 10px", borderRadius: 10, border: `1.5px solid ${BRAND.border}`, background: "#fff", fontSize: 13.5, color: BRAND.ink, fontFamily: FONT, ...extra };
}

function buttonStyle(variant, disabled = false) {
  const base = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 18px", borderRadius: 12, fontSize: 14, fontWeight: 800, fontFamily: FONT, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1 };
  if (variant === "ghost") return { ...base, background: "#fff", color: BRAND.inkSoft, border: `1.5px solid ${BRAND.border}` };
  if (variant === "danger") return { ...base, background: BRAND.danger, color: "#fff", border: `1.5px solid ${BRAND.danger}` };
  return { ...base, background: BRAND.navy, color: "#fff", border: `1.5px solid ${BRAND.navy}` };
}
