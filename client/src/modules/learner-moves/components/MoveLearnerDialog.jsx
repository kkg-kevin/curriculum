import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  FiAlertTriangle, FiArrowRight, FiAward, FiCalendar, FiCheck, FiCompass, FiCpu, FiFileText, FiHome, FiInfo, FiMapPin, FiX,
} from "react-icons/fi";
import api from "../../../services/api";
import { BRAND, FONT } from "../../../theme/brand";
import { homeLearningApi } from "../../home-learning/services/homeLearningApi";
import { EnrollmentFields, HouseholdFields } from "../../home-learning/components/HouseholdFields";
import { learnerMovesApi, PERIOD_LABELS, PROGRAMME_LABELS } from "../services/learnerMovesApi";

// Moving a learner between programmes, in one go (server modules/learner-moves/): where to — a hub
// class, a bootcamp run, Home Learning, a Tech Club or a pathway plan — the new place, opened the way
// that programme opens it; the places they leave, ended (kept on their record, never deleted), and a
// household / membership / subscription left with no child stopped when ticked. Their work,
// reports, certificates, attendance and invoices stay theirs; nothing owed changes. A new household,
// membership or subscription is billed from the day chosen here.

const NEW = "new";
const lower = (s) => String(s || "").trim().toLowerCase();
const money = (n, currency = "KES") => `${currency} ${Number(n || 0).toLocaleString("en-KE")}`;
const fmtDate = (d) => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

const PROGRAMMES = [
  { key: "hub", icon: FiMapPin, hint: "A class at a school or hub" },
  { key: "bootcamp", icon: FiCalendar, hint: "A run that hasn't ended" },
  { key: "home_learning", icon: FiHome, hint: "A household, with an educator at home" },
  { key: "tech_club", icon: FiCpu, hint: "A club membership" },
  { key: "pathway", icon: FiCompass, hint: "Self-paced, on a plan" },
];

const CONTAINER = { home_learning: "household", tech_club: "membership", pathway: "subscription" };

export default function MoveLearnerDialog({ open, learnerId, onClose, onMoved }) {
  const queryClient = useQueryClient();
  const optionsQuery = useQuery({
    queryKey: ["learner-moves", learnerId],
    queryFn: () => learnerMovesApi.options(learnerId),
    enabled: Boolean(open && learnerId),
    staleTime: 0,
  });
  const options = optionsQuery.data;
  const D = options?.destinations;
  const [programme, setProgramme] = useState("");
  const wantsHL = open && programme === "home_learning";
  const { data: hlPackageRows } = useQuery({ queryKey: ["home-learning", "packages"], queryFn: homeLearningApi.getPackages, enabled: wantsHL });
  const { data: curriculumRows } = useQuery({ queryKey: ["home-learning", "curricula"], queryFn: () => api.get("/api/curricula").then((r) => r.data.data || []), enabled: wantsHL });
  const { data: teacherRows } = useQuery({ queryKey: ["home-learning", "educators"], queryFn: () => api.get("/api/teachers").then((r) => r.data.data || []), enabled: wantsHL });
  const hlPackages = Array.isArray(hlPackageRows) ? hlPackageRows : [];
  const curricula = Array.isArray(curriculumRows) ? curriculumRows : [];
  const educators = Array.isArray(teacherRows) ? teacherRows.filter((t) => (t.status || "active") === "active") : [];

  const [hubForm, setHubForm] = useState({ hubId: "", classId: "" });
  const [bootForm, setBootForm] = useState({ bootcampId: "", hubId: "", classId: "", invoice: false });
  const [householdChoice, setHouseholdChoice] = useState(NEW);
  const [household, setHousehold] = useState({});
  const [placement, setPlacement] = useState({ curriculumId: "", gradeId: "", educatorId: "" });
  const [clubForm, setClubForm] = useState({});
  const [pathForm, setPathForm] = useState({});
  const [endKeys, setEndKeys] = useState([]);
  const [stopKeys, setStopKeys] = useState([]);
  const [saving, setSaving] = useState(false);

  // Start from the child's record: the parent's details, today; every active place ticked to leave,
  // and any household / membership / subscription it would leave empty ticked to stop.
  useEffect(() => {
    if (!options) return;
    const l = options.learner;
    const parent = { guardianName: l.guardianName, guardianEmail: l.guardianEmail, guardianPhone: l.guardianPhone };
    setHousehold({
      ...parent, packageId: "", billingPeriod: "", childCount: "", status: "active", startDate: options.today,
      county: "", subCounty: "", town: "", addressLine: "", landmark: "", mapUrl: "", locationPhotos: [], notes: "", portalPassword: "",
    });
    const withRoom = options.destinations.homeLearning.households.find((h) => h.activeChildren < h.childCount);
    setHouseholdChoice(withRoom ? withRoom.id : NEW);
    setClubForm({ hubId: "", membershipId: NEW, packageId: "", billingPeriod: "", startDate: options.today, classId: "", ...parent });
    setPathForm({ packageId: "", curriculumId: "", pathwayRowId: "", hubId: "", subscriptionId: NEW, billingPeriod: "", startDate: options.today, ...parent });
    const active = options.places.filter((p) => p.status === "active");
    setEndKeys(active.map((p) => p.key));
    setStopKeys(active.filter((p) => p.leavesEmpty).map((p) => p.key));
  }, [options]);
  useEffect(() => {
    if (!open) { setProgramme(""); setPlacement({ curriculumId: "", gradeId: "", educatorId: "" }); setHubForm({ hubId: "", classId: "" }); setBootForm({ bootcampId: "", hubId: "", classId: "", invoice: false }); setSaving(false); }
  }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape" && !saving) onClose?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, saving, onClose]);

  // ── Derived choices ──
  const hubs = D?.hubs || [];
  const hubOf = (id) => hubs.find((h) => h.id === id);
  const bootcamp = D?.bootcamps.find((b) => b.id === bootForm.bootcampId);
  const run = bootcamp?.runs.find((r) => r.hubId === bootForm.hubId);
  const club = D?.techClubs.clubs.find((c) => c.id === clubForm.hubId);
  const clubPackages = (D?.techClubs.packages || []).filter((p) => club && (!p.hubIds.length || p.hubIds.includes(club.id)));
  const clubPackage = clubPackages.find((p) => p.id === clubForm.packageId);
  const clubMemberships = (D?.techClubs.memberships || []).filter((m) => m.hubId === clubForm.hubId && m.status !== "cancelled");
  const plan = D?.pathways.plans.find((p) => p.id === pathForm.packageId);
  const pathwayInfo = plan ? D.pathways.pathways.find((w) => w.templateId === plan.pathwayTemplateId) : null;
  const pathCurriculum = pathwayInfo ? (pathwayInfo.curricula.find((c) => c.curriculumId === pathForm.curriculumId) || pathwayInfo.curricula[0]) : null;
  const familySubs = plan ? (D.pathways.subscriptions || []).filter((s) => s.pathwayTemplateId === plan.pathwayTemplateId && s.status !== "cancelled") : [];

  const available = useMemo(() => {
    if (!D) return {};
    return {
      hub: hubs.some((h) => h.classes.length) || hubs.length > 0,
      bootcamp: D.bootcamps.length > 0,
      home_learning: true,
      tech_club: D.techClubs.clubs.length > 0 && D.techClubs.packages.length > 0,
      pathway: D.pathways.plans.length > 0,
    };
  }, [D, hubs]);
  const emptyReason = { hub: "No active hubs", bootcamp: "No bootcamp run coming up", tech_club: "No clubs with packages", pathway: "No pathway plans yet" };

  const destCurriculumId = (() => {
    if (programme === "hub") return hubOf(hubForm.hubId)?.classes.find((c) => c.id === hubForm.classId)?.curriculumId || null;
    if (programme === "bootcamp") return bootcamp?.curriculumId || null;
    if (programme === "home_learning") return placement.curriculumId || null;
    if (programme === "tech_club") return club?.classes.find((c) => c.id === clubForm.classId)?.curriculumId || null;
    if (programme === "pathway") return pathCurriculum?.curriculumId || null;
    return null;
  })();
  const fromCurriculumIds = (options?.places || []).map((p) => p.curriculumId).filter(Boolean);
  const continuity = !destCurriculumId ? null : fromCurriculumIds.includes(destCurriculumId) ? "same" : fromCurriculumIds.length ? "different" : null;

  const parentEmailDiffers = (email) => {
    const was = lower(options?.learner.guardianEmail);
    return Boolean(was) && lower(email) !== was;
  };

  if (!open) return null;

  const learnerName = options ? `${options.learner.firstName} ${options.learner.lastName}`.trim() : "this learner";

  const destination = () => {
    if (programme === "hub") return { programme, hubId: hubForm.hubId, classId: hubForm.classId || null };
    if (programme === "bootcamp") return { programme, bootcampId: bootForm.bootcampId, hubId: bootForm.hubId, classId: bootForm.classId || null, invoice: !!bootForm.invoice };
    if (programme === "home_learning") {
      const { billingPeriod, childCount, ...rest } = household;
      return {
        programme, enrollment: placement,
        ...(householdChoice === NEW
          ? { household: { ...rest, ...(billingPeriod ? { billingPeriod } : {}), ...(childCount ? { childCount: Number(childCount) } : {}) } }
          : { householdId: householdChoice }),
      };
    }
    if (programme === "tech_club") {
      return {
        programme, hubId: clubForm.hubId, classId: clubForm.classId || null,
        ...(clubForm.membershipId === NEW
          ? { membership: { packageId: clubForm.packageId, billingPeriod: clubForm.billingPeriod || undefined, startDate: clubForm.startDate, guardianName: clubForm.guardianName, guardianEmail: clubForm.guardianEmail, guardianPhone: clubForm.guardianPhone } }
          : { membershipId: clubForm.membershipId }),
      };
    }
    return {
      programme, packageId: pathForm.packageId, hubId: pathForm.hubId, curriculumId: pathCurriculum?.curriculumId || null, pathwayRowId: pathForm.pathwayRowId || null,
      ...(pathForm.subscriptionId === NEW
        ? { billingPeriod: pathForm.billingPeriod || null, startDate: pathForm.startDate, guardianName: pathForm.guardianName, guardianEmail: pathForm.guardianEmail, guardianPhone: pathForm.guardianPhone }
        : { subscriptionId: pathForm.subscriptionId }),
    };
  };

  const missing = () => {
    if (!programme) return "Choose where they're moving to";
    if (programme === "hub" && !hubForm.hubId) return "Choose a hub";
    if (programme === "bootcamp" && (!bootForm.bootcampId || !bootForm.hubId)) return "Choose the bootcamp and where it runs";
    if (programme === "home_learning") {
      if (!placement.curriculumId || !placement.gradeId) return "Choose their curriculum and grade";
      if (householdChoice === NEW && !household.packageId) return "Choose a package for the household";
    }
    if (programme === "tech_club") {
      if (!clubForm.hubId) return "Choose a club";
      if (clubForm.membershipId === NEW && !clubForm.packageId) return "Choose a package for the membership";
    }
    if (programme === "pathway") {
      if (!pathForm.packageId) return "Choose a pathway plan";
      if (!pathForm.hubId) return "Choose the hub they belong to";
    }
    return null;
  };

  const submit = async (event) => {
    event.preventDefault();
    const problem = missing();
    if (problem) { toast.error(problem); return; }
    setSaving(true);
    try {
      const result = await learnerMovesApi.move(learnerId, { destination: destination(), endKeys, stopKeys: stopKeys.filter((k) => endKeys.includes(k)) });
      const extra = result.invoice ? ` — invoice ${result.invoice.invoiceNumber} raised` : "";
      const where = `${PROGRAMME_LABELS[result.programme]}: ${result.label}`;
      toast.success(result.active ? `Moved — ${where}${extra}` : `Moved — ${where}. Their place starts once it's active`);
      for (const n of result.notEnded || []) toast.error(`Couldn't leave ${n.label}: ${n.reason}`, { duration: 8000 });
      queryClient.invalidateQueries();
      onMoved?.(result);
    } catch (err) {
      toast.error(err.errors?.[0]?.message || err.response?.data?.message || err.message || "Couldn't move them");
    } finally {
      setSaving(false);
    }
  };

  const toggle = (list, setList, key, on) => setList((ids) => (on ? [...new Set([...ids, key])] : ids.filter((x) => x !== key)));

  return createPortal(
    <div role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose?.(); }}
      style={{ position: "fixed", inset: 0, zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(17,32,51,0.45)", backdropFilter: "blur(3px)", fontFamily: FONT }}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="move-learner-title"
        style={{ position: "relative", width: "100%", maxWidth: 860, maxHeight: "calc(100vh - 32px)", display: "flex", flexDirection: "column", background: BRAND.surface, borderRadius: 18, overflow: "hidden", boxShadow: "0 24px 64px rgba(17,32,51,0.28)" }}>
        <div aria-hidden="true" style={{ height: 5, flexShrink: 0, background: `linear-gradient(90deg, ${BRAND.navy}, ${BRAND.mid} 55%, ${BRAND.sky})` }} />
        <button type="button" aria-label="Close" onClick={() => !saving && onClose?.()}
          style={{ position: "absolute", top: 14, right: 12, width: 32, height: 32, display: "grid", placeItems: "center", border: "none", borderRadius: 10, background: "transparent", color: BRAND.faint, cursor: "pointer" }}>
          <FiX size={18} />
        </button>

        <div style={{ padding: "20px 24px 12px", borderBottom: `1px solid ${BRAND.line}`, flexShrink: 0 }}>
          <h2 id="move-learner-title" style={{ margin: "0 36px 4px 0", fontSize: 18, fontWeight: 800, color: BRAND.ink, display: "flex", alignItems: "center", gap: 8 }}><FiArrowRight size={18} color={BRAND.mid} /> Move {learnerName}</h2>
          <p style={{ margin: 0, fontSize: 13, color: BRAND.muted, lineHeight: 1.5 }}>To another class, a bootcamp, Home Learning, a Tech Club or a pathway plan. Everything they&apos;ve done stays on their record.</p>
        </div>

        <div style={{ padding: "16px 24px", overflowY: "auto", flex: 1 }}>
          {optionsQuery.isLoading && <p style={{ color: BRAND.muted, fontSize: 14 }}>Loading…</p>}
          {optionsQuery.isError && <Note tone="danger">{optionsQuery.error?.response?.data?.message || optionsQuery.error?.message || "Couldn't load this learner."}</Note>}

          {options && (
            <>
              <Section title="Where to">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(146px, 1fr))", gap: 8 }}>
                  {PROGRAMMES.map(({ key, icon: Icon, hint }) => {
                    const allowed = options.allowed[key];
                    const has = available[key];
                    const disabled = !allowed || !has;
                    const on = programme === key;
                    return (
                      <button key={key} type="button" disabled={disabled} onClick={() => setProgramme(key)} aria-pressed={on}
                        style={{ textAlign: "left", padding: "11px 12px", borderRadius: 12, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1, fontFamily: FONT,
                          border: `1.5px solid ${on ? BRAND.navy : BRAND.border}`, background: on ? BRAND.navyTint : "#fff" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 800, color: on ? BRAND.navy : BRAND.ink }}><Icon size={15} /> {PROGRAMME_LABELS[key]}</span>
                        <span style={{ display: "block", fontSize: 11.5, color: BRAND.muted, marginTop: 3, lineHeight: 1.4 }}>{!allowed ? "Your role can't add people here" : !has ? emptyReason[key] : hint}</span>
                      </button>
                    );
                  })}
                </div>
              </Section>

              {programme === "hub" && (
                <Section title="Their new class">
                  <Grid>
                    <Field label="Hub">
                      <select style={field} value={hubForm.hubId} onChange={(e) => setHubForm({ hubId: e.target.value, classId: "" })}>
                        <option value="">Choose a hub</option>
                        {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                      </select>
                    </Field>
                    <Field label="Class">
                      <select style={field} value={hubForm.classId} onChange={(e) => setHubForm((f) => ({ ...f, classId: e.target.value }))} disabled={!hubForm.hubId}>
                        <option value="">No class yet</option>
                        {(hubOf(hubForm.hubId)?.classes || []).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    </Field>
                  </Grid>
                </Section>
              )}

              {programme === "bootcamp" && (
                <Section title="The bootcamp">
                  <Grid>
                    <Field label="Bootcamp">
                      <select style={field} value={bootForm.bootcampId} onChange={(e) => {
                        const b = D.bootcamps.find((x) => x.id === e.target.value);
                        setBootForm((f) => ({ ...f, bootcampId: e.target.value, hubId: b?.runs.length === 1 ? b.runs[0].hubId : "", classId: "" }));
                      }}>
                        <option value="">Choose a bootcamp</option>
                        {D.bootcamps.map((b) => <option key={b.id} value={b.id}>{b.name}{b.startDate ? ` · ${fmtDate(b.startDate)}${b.endDate ? ` – ${fmtDate(b.endDate)}` : ""}` : ""}</option>)}
                      </select>
                    </Field>
                    <Field label="Where it runs">
                      <select style={field} value={bootForm.hubId} onChange={(e) => setBootForm((f) => ({ ...f, hubId: e.target.value, classId: "" }))} disabled={!bootcamp}>
                        <option value="">Choose a hub</option>
                        {(bootcamp?.runs || []).map((r) => <option key={r.hubId} value={r.hubId}>{r.hubName}</option>)}
                      </select>
                    </Field>
                    <Field label="Class">
                      <select style={field} value={bootForm.classId} onChange={(e) => setBootForm((f) => ({ ...f, classId: e.target.value }))} disabled={!run}>
                        <option value="">The one for their stage (chosen for them)</option>
                        {(run?.classes || []).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    </Field>
                  </Grid>
                  {bootcamp && (
                    <label style={checkRow}>
                      <input type="checkbox" checked={!!bootForm.invoice} disabled={!bootcamp.price} onChange={(e) => setBootForm((f) => ({ ...f, invoice: e.target.checked }))} />
                      <span>{bootcamp.price ? <>Raise the bootcamp&apos;s invoice now ({money(bootcamp.price.amount, bootcamp.price.currency)}), emailed to the family</> : "This bootcamp has no price set — no invoice will be raised"}</span>
                    </label>
                  )}
                </Section>
              )}

              {programme === "home_learning" && (
                <>
                  <Section title="Household">
                    <select value={householdChoice} onChange={(e) => setHouseholdChoice(e.target.value)} style={{ ...field, width: "100%" }} aria-label="Household">
                      {D.homeLearning.households.map((h) => {
                        const full = h.activeChildren >= h.childCount;
                        return <option key={h.id} value={h.id} disabled={full}>{h.guardianName}&apos;s household · {h.activeChildren}/{h.childCount} children · {h.status}{full ? " — full" : ""}</option>;
                      })}
                      <option value={NEW}>A new household</option>
                    </select>
                    {householdChoice === NEW && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14, marginTop: 12 }}>
                        <HouseholdFields values={household} setValue={(key, value) => setHousehold((h) => ({ ...h, [key]: value }))} packages={hlPackages} showStatus />
                      </div>
                    )}
                    {householdChoice === NEW && parentEmailDiffers(household.guardianEmail) && <EmailNote learner={options.learner} />}
                    {householdChoice === NEW && <BillingNote what="household" />}
                  </Section>
                  <Section title="Their Home Learning place">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
                      <EnrollmentFields values={placement} setValue={(key, value) => setPlacement((p) => ({ ...p, [key]: value }))} curricula={curricula} educators={educators} />
                    </div>
                  </Section>
                </>
              )}

              {programme === "tech_club" && (
                <Section title="The club">
                  <Grid>
                    <Field label="Club">
                      <select style={field} value={clubForm.hubId} onChange={(e) => {
                        const hubId = e.target.value;
                        const withRoom = (D.techClubs.memberships || []).find((m) => m.hubId === hubId && m.status !== "cancelled" && m.activeChildren < m.childCount);
                        setClubForm((f) => ({ ...f, hubId, classId: "", packageId: "", billingPeriod: "", membershipId: withRoom ? withRoom.id : NEW }));
                      }}>
                        <option value="">Choose a club</option>
                        {D.techClubs.clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </Field>
                    <Field label="Membership">
                      <select style={field} value={clubForm.membershipId} onChange={(e) => setClubForm((f) => ({ ...f, membershipId: e.target.value }))} disabled={!club}>
                        {clubMemberships.map((m) => {
                          const full = m.activeChildren >= m.childCount;
                          return <option key={m.id} value={m.id} disabled={full}>{m.guardianName}&apos;s{m.packageName ? ` · ${m.packageName}` : ""} · {m.activeChildren}/{m.childCount} children{full ? " — full" : ""}</option>;
                        })}
                        <option value={NEW}>A new membership</option>
                      </select>
                    </Field>
                    <Field label="Class">
                      <select style={field} value={clubForm.classId} onChange={(e) => setClubForm((f) => ({ ...f, classId: e.target.value }))} disabled={!club}>
                        <option value="">Awaiting a class</option>
                        {(club?.classes || []).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    </Field>
                  </Grid>
                  {club && clubForm.membershipId === NEW && (
                    <>
                      <Grid>
                        <Field label="Package">
                          <select style={field} value={clubForm.packageId} onChange={(e) => {
                            const p = clubPackages.find((x) => x.id === e.target.value);
                            setClubForm((f) => ({ ...f, packageId: e.target.value, billingPeriod: p?.defaultPeriod || "" }));
                          }}>
                            <option value="">{clubPackages.length ? "Choose a package" : "No package is offered at this club"}</option>
                            {clubPackages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </Field>
                        <PeriodField prices={clubPackage?.prices} value={clubForm.billingPeriod} onChange={(v) => setClubForm((f) => ({ ...f, billingPeriod: v }))} />
                        <StartField today={options.today} value={clubForm.startDate} onChange={(v) => setClubForm((f) => ({ ...f, startDate: v }))} />
                      </Grid>
                      <ParentFields values={clubForm} onChange={(k, v) => setClubForm((f) => ({ ...f, [k]: v }))} />
                      {parentEmailDiffers(clubForm.guardianEmail) && <EmailNote learner={options.learner} />}
                      <BillingNote what="membership" />
                    </>
                  )}
                </Section>
              )}

              {programme === "pathway" && (
                <Section title="The pathway plan">
                  <Grid>
                    <Field label="Plan">
                      <select style={field} value={pathForm.packageId} onChange={(e) => {
                        const p = D.pathways.plans.find((x) => x.id === e.target.value);
                        const info = p ? D.pathways.pathways.find((w) => w.templateId === p.pathwayTemplateId) : null;
                        const cur = info?.curricula.find((c) => fromCurriculumIds.includes(c.curriculumId)) || info?.curricula[0];
                        const subs = p ? (D.pathways.subscriptions || []).filter((s) => s.pathwayTemplateId === p.pathwayTemplateId && s.status !== "cancelled" && s.activeChildren < s.childCount) : [];
                        const stayHub = (options.places.find((x) => x.hubId && hubs.some((h) => h.id === x.hubId))?.hubId) || "";
                        setPathForm((f) => ({
                          ...f, packageId: e.target.value, billingPeriod: p?.defaultPeriod || "", curriculumId: cur?.curriculumId || "",
                          pathwayRowId: cur?.suggestedRowId || "", subscriptionId: subs[0]?.id || NEW, hubId: f.hubId || subs[0]?.hubId || stayHub,
                        }));
                      }}>
                        <option value="">Choose a plan</option>
                        {D.pathways.pathways.map((w) => (
                          <optgroup key={w.templateId} label={w.name}>
                            {D.pathways.plans.filter((p) => p.pathwayTemplateId === w.templateId).map((p) => <option key={p.id} value={p.id}>{p.name}{p.isPublished ? "" : " (not on the website)"}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    </Field>
                    {pathwayInfo && pathwayInfo.curricula.length > 1 && (
                      <Field label="Curriculum">
                        <select style={field} value={pathCurriculum?.curriculumId || ""} onChange={(e) => {
                          const cur = pathwayInfo.curricula.find((c) => c.curriculumId === e.target.value);
                          setPathForm((f) => ({ ...f, curriculumId: e.target.value, pathwayRowId: cur?.suggestedRowId || "" }));
                        }}>
                          {pathwayInfo.curricula.map((c) => <option key={c.curriculumId} value={c.curriculumId}>{c.curriculumName}</option>)}
                        </select>
                      </Field>
                    )}
                    {pathCurriculum && pathCurriculum.stages.length > 1 && (
                      <Field label="Stage" hint="Kept as it is if they're already on this pathway">
                        <select style={field} value={pathForm.pathwayRowId} onChange={(e) => setPathForm((f) => ({ ...f, pathwayRowId: e.target.value }))}>
                          {pathCurriculum.stages.map((s) => <option key={s.rowId} value={s.rowId}>{s.name}{s.minAge != null ? ` (ages ${s.minAge}–${s.maxAge})` : ""}{s.rowId === pathCurriculum.suggestedRowId ? " — their age" : ""}</option>)}
                        </select>
                      </Field>
                    )}
                    <Field label="Hub they belong to" hint="A class there is optional">
                      <select style={field} value={pathForm.hubId} onChange={(e) => setPathForm((f) => ({ ...f, hubId: e.target.value }))}>
                        <option value="">Choose a hub</option>
                        {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                      </select>
                    </Field>
                    {plan && (
                      <Field label="Subscription">
                        <select style={field} value={pathForm.subscriptionId} onChange={(e) => setPathForm((f) => ({ ...f, subscriptionId: e.target.value }))}>
                          {familySubs.map((s) => {
                            const full = s.activeChildren >= s.childCount;
                            return <option key={s.id} value={s.id} disabled={full}>{s.guardianName}&apos;s{s.planName ? ` · ${s.planName}` : ""} · {s.activeChildren}/{s.childCount} children{full ? " — full" : ""}</option>;
                          })}
                          <option value={NEW}>A new subscription</option>
                        </select>
                      </Field>
                    )}
                  </Grid>
                  {plan && pathForm.subscriptionId === NEW && (
                    <>
                      <Grid>
                        <PeriodField prices={plan.prices} value={pathForm.billingPeriod} onChange={(v) => setPathForm((f) => ({ ...f, billingPeriod: v }))} />
                        <StartField today={options.today} value={pathForm.startDate} onChange={(v) => setPathForm((f) => ({ ...f, startDate: v }))}
                          hint="A later day: their courses stay open until then" />
                      </Grid>
                      <ParentFields values={pathForm} onChange={(k, v) => setPathForm((f) => ({ ...f, [k]: v }))} />
                      {parentEmailDiffers(pathForm.guardianEmail) && <EmailNote learner={options.learner} />}
                      <BillingNote what="subscription" />
                    </>
                  )}
                </Section>
              )}

              {programme && (
                <>
                  <Section title="Where they are now">
                    {options.places.length === 0 ? <p style={muted}>No other place — the new one will be their only one.</p> : options.places.map((p) => {
                      const leaving = endKeys.includes(p.key);
                      return (
                        <div key={p.key} style={{ border: `1px solid ${leaving ? BRAND.skyBorder : BRAND.border}`, background: leaving ? BRAND.skyTint : "#fff", borderRadius: 12, marginBottom: 6, padding: "9px 12px" }}>
                          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
                            <input type="checkbox" checked={leaving} onChange={(e) => toggle(endKeys, setEndKeys, p.key, e.target.checked)} style={{ marginTop: 3 }} />
                            <span style={{ minWidth: 0 }}>
                              <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: BRAND.ink }}>{p.label}{p.detail ? ` · ${p.detail}` : ""}</span>
                              <span style={{ display: "block", fontSize: 12, color: BRAND.muted }}>
                                {PROGRAMME_LABELS[p.programme]}{p.status !== "active" ? ` · ${p.status}` : ""} — {leaving ? "they leave it (kept on their record as ended)" : "they keep it"}
                              </span>
                            </span>
                          </label>
                          {leaving && p.leavesEmpty && (
                            <label style={{ ...checkRow, margin: "8px 0 0 26px" }}>
                              <input type="checkbox" checked={stopKeys.includes(p.key)} onChange={(e) => toggle(stopKeys, setStopKeys, p.key, e.target.checked)} />
                              <span>Also stop this {CONTAINER[p.programme]} — no child is left on it, so it isn&apos;t billed for nobody{p.programme === "pathway" ? ". Their courses stay open to the end of the period already paid" : ""}</span>
                            </label>
                          )}
                          {leaving && !p.leavesEmpty && CONTAINER[p.programme] && (
                            <p style={{ ...muted, margin: "6px 0 0 26px" }}>Others stay on this {CONTAINER[p.programme]}; its package and price don&apos;t change.</p>
                          )}
                        </div>
                      );
                    })}
                  </Section>

                  <Section title="What stays with them">
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      <Keep icon={FiCheck} n={options.keeps.markedWork} one="piece of marked work" many="pieces of marked work" />
                      <Keep icon={FiFileText} n={options.keeps.reports} one="published report" many="published reports" />
                      <Keep icon={FiAward} n={options.keeps.certificates} one="certificate" many="certificates" />
                      <Keep icon={FiCalendar} n={options.keeps.attendanceDays} one="day of attendance" many="days of attendance" />
                      <Keep icon={FiCompass} n={options.keeps.pathways} one="pathway placement" many="pathway placements" />
                    </div>
                    {continuity === "same" && <p style={{ ...muted, display: "flex", gap: 6, marginTop: 8 }}><FiInfo size={14} style={{ flexShrink: 0, marginTop: 2 }} /> Same curriculum as before — the work they&apos;ve done there still counts in the new place.</p>}
                    {continuity === "different" && <p style={{ ...muted, display: "flex", gap: 6, marginTop: 8 }}><FiInfo size={14} style={{ flexShrink: 0, marginTop: 2 }} /> A different curriculum — its courses start fresh. Everything they&apos;ve done before stays on their record and in their reports.</p>}
                  </Section>

                  {options.openInvoices.length > 0 && (
                    <Note tone="waiting">
                      {options.openInvoices.length === 1 ? "An invoice is" : `${options.openInvoices.length} invoices are`} still unpaid ({options.openInvoices.map((i) => `${i.invoiceNumber} · ${money(i.owed, i.currency)}`).join(", ")}). Moving doesn&apos;t change that: it stays owed, and the usual pause for unpaid invoices still applies.
                    </Note>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap", padding: "14px 24px", borderTop: `1px solid ${BRAND.line}`, flexShrink: 0 }}>
          <button type="button" onClick={onClose} disabled={saving} style={button("ghost")}>Cancel</button>
          {options && (
            <button type="submit" disabled={saving || !programme} style={button("primary", saving || !programme)}><FiArrowRight size={15} /> {saving ? "Moving…" : programme ? `Move to ${PROGRAMME_LABELS[programme]}` : "Move"}</button>
          )}
        </div>
      </form>
    </div>,
    document.body,
  );
}

function Keep({ icon: Icon, n, one, many }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 999, background: BRAND.greyTint, border: `1px solid ${BRAND.border}`, fontSize: 12.5, color: BRAND.inkSoft }}>
      <Icon size={13} color={BRAND.mid} /> <strong style={{ color: BRAND.ink }}>{n}</strong> {n === 1 ? one : many}
    </span>
  );
}

function PeriodField({ prices, value, onChange }) {
  const list = Array.isArray(prices) ? prices : [];
  return (
    <Field label="Paid">
      <select style={field} value={value || ""} onChange={(e) => onChange(e.target.value)} disabled={!list.length}>
        {!list.length && <option value="">Choose a package first</option>}
        {list.map((p) => <option key={p.billingPeriod} value={p.billingPeriod}>{PERIOD_LABELS[p.billingPeriod] || p.billingPeriod} · {money(p.amount)}</option>)}
      </select>
    </Field>
  );
}

function StartField({ today, value, onChange, hint }) {
  return (
    <Field label="Billing starts" hint={hint || "Today, or later to cover time already paid elsewhere"}>
      <input type="date" style={field} min={today} value={value || ""} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

function ParentFields({ values, onChange }) {
  return (
    <Grid>
      <Field label="Parent / guardian"><input style={field} value={values.guardianName || ""} onChange={(e) => onChange("guardianName", e.target.value)} maxLength={150} /></Field>
      <Field label="Parent's email"><input style={field} type="email" value={values.guardianEmail || ""} onChange={(e) => onChange("guardianEmail", e.target.value)} maxLength={255} /></Field>
      <Field label="Parent's phone"><input style={field} value={values.guardianPhone || ""} onChange={(e) => onChange("guardianPhone", e.target.value)} maxLength={30} /></Field>
    </Grid>
  );
}

function EmailNote({ learner }) {
  return <Note tone="waiting">This isn&apos;t the parent email on {learner.firstName}&apos;s record ({learner.guardianEmail}). The parent&apos;s login won&apos;t see the invoices unless it&apos;s the same email.</Note>;
}

function BillingNote({ what }) {
  return <p style={{ ...muted, display: "flex", gap: 6, marginTop: 8 }}><FiInfo size={14} style={{ flexShrink: 0, marginTop: 2 }} /> The new {what} is invoiced automatically each period from its start day, like any other.</p>;
}

function Grid({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 10 }}>{children}</div>;
}

function Field({ label, hint, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12.5, fontWeight: 700, color: BRAND.inkSoft, minWidth: 0 }}>
      {label}
      {children}
      {hint && <span style={{ fontWeight: 400, fontSize: 11.5, color: BRAND.muted }}>{hint}</span>}
    </label>
  );
}

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 16 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 800, color: BRAND.sky, textTransform: "uppercase", letterSpacing: "0.07em" }}>{title}</h3>
      {children}
    </section>
  );
}

function Note({ tone, children }) {
  const [bg, border, color] = {
    info: [BRAND.skyTint, BRAND.skyBorder, BRAND.navy],
    waiting: [BRAND.goldTint, BRAND.goldBorder, BRAND.goldText],
    danger: [BRAND.dangerTint, BRAND.dangerBorder, BRAND.danger],
  }[tone] || [BRAND.greyTint, BRAND.border, BRAND.greyText];
  return (
    <div role={tone === "danger" ? "alert" : undefined} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: 12, background: bg, border: `1px solid ${border}`, color, fontSize: 13, lineHeight: 1.5, margin: "8px 0 12px" }}>
      <FiAlertTriangle size={15} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

const muted = { margin: 0, fontSize: 12.5, color: BRAND.muted, lineHeight: 1.5 };
const field = { padding: "9px 11px", borderRadius: 10, border: `1.5px solid ${BRAND.border}`, background: "#fff", fontSize: 13.5, color: BRAND.ink, fontFamily: FONT, width: "100%", boxSizing: "border-box", minWidth: 0 };
const checkRow = { display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, color: BRAND.inkSoft, lineHeight: 1.45, cursor: "pointer", marginTop: 6 };

function button(variant, disabled = false) {
  const base = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 18px", borderRadius: 12, fontSize: 14, fontWeight: 800, fontFamily: FONT, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.65 : 1 };
  return variant === "ghost"
    ? { ...base, background: "#fff", color: BRAND.inkSoft, border: `1.5px solid ${BRAND.border}` }
    : { ...base, background: BRAND.navy, color: "#fff", border: `1.5px solid ${BRAND.navy}` };
}

