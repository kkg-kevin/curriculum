import { useState } from "react";
import { Link } from "react-router-dom";
import { FiBookOpen, FiChevronDown, FiExternalLink, FiFolder, FiGlobe, FiSearch, FiUsers } from "react-icons/fi";
import { usePathwayDirectory, useSetPathwayWebsite, useSetPathwayPricing } from "../hooks/usePathwayTemplates";
import RichContent, { isEmptyHtml } from "../../../courses/components/RichContent";
import ImageUploadField from "../../../../components/ImageUploadField";

const ages = (s) => (s.minAge != null && s.maxAge != null ? ` (${s.minAge}–${s.maxAge} yrs)` : "");

function CourseList({ courses, color }) {
  if (!courses.length) return <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9CA3AF", fontStyle: "italic" }}>No courses yet</p>;
  return (
    <div className="stg-course-list">
      {courses.map((c) => (
        <div key={c.id} className="stg-course-row">
          <span className="stg-course-dot" style={{ backgroundColor: color }} />
          <span className="stg-course-name">{c.name}</span>
        </div>
      ))}
    </div>
  );
}

const MODES = [
  { key: "none", label: "No price", hint: "The website takes an enquiry; our team follows up." },
  { key: "whole", label: "Whole pathway", hint: "One price per child for the pathway." },
  { key: "by_course", label: "Per course", hint: "Each course has its own price; a family pays for the course the learner starts at." },
];

// The pathway's price on the website. With a price (and hubs to choose from), the website's Enrol
// signs the family up and takes payment instead of sending an enquiry.
function PricingSettings({ pathway }) {
  const { mutate: save, isPending } = useSetPathwayPricing();
  const initial = pathway.pricing || { mode: "none", amount: null, currency: "KES", coursePrices: [] };
  const [mode, setMode] = useState(initial.mode);
  const [amount, setAmount] = useState(initial.amount ?? "");
  const [prices, setPrices] = useState(() => Object.fromEntries((initial.coursePrices || []).map((p) => [p.courseId, String(p.amount)])));
  // Every course of the pathway once, in the order they first appear (curriculum, then stage).
  const seen = new Set();
  const courses = pathway.curricula.flatMap((c) => c.stages.flatMap((s) => s.courses)).filter((c) => !seen.has(c.id) && seen.add(c.id));
  const submit = () => save({
    id: pathway.templateId,
    data: {
      mode,
      priceAmount: mode === "whole" && amount !== "" ? Number(amount) : null,
      currency: initial.currency || "KES",
      coursePrices: mode === "by_course" ? courses.map((c) => ({ courseId: c.id, amount: prices[c.id] === undefined || prices[c.id] === "" ? null : Number(prices[c.id]) })) : [],
    },
  });
  const input = { width: 130, padding: "7px 10px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 13, fontFamily: "Inter, sans-serif" };

  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px dashed #E5E7EB" }}>
      <p style={{ margin: "0 0 6px", fontSize: 12.5, fontWeight: 700, color: "#111827" }}>Price</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {MODES.map((m) => (
          <label key={m.key} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 20, border: `1.5px solid ${mode === m.key ? "#25476a" : "#E5E7EB"}`, backgroundColor: mode === m.key ? "#25476a" : "#fff", color: mode === m.key ? "#fff" : "#374151", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
            <input type="radio" name={`price-${pathway.key}`} checked={mode === m.key} onChange={() => setMode(m.key)} style={{ display: "none" }} />
            {m.label}
          </label>
        ))}
      </div>
      <p style={{ margin: "6px 0 0", fontSize: 12, color: "#6B7280" }}>{MODES.find((m) => m.key === mode)?.hint}</p>

      {mode === "whole" && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 13, color: "#374151" }}>
          {initial.currency || "KES"}
          <input type="number" min="0" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 15000" style={input} />
          <span style={{ color: "#9CA3AF", fontSize: 12 }}>per child</span>
        </label>
      )}
      {mode === "by_course" && (
        <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
          {courses.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF", fontStyle: "italic" }}>This pathway has no courses yet.</p>
          ) : courses.map((c) => (
            <label key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "6px 10px", borderRadius: 8, backgroundColor: "#F9FAFB", fontSize: 13, color: "#111827" }}>
              <span style={{ minWidth: 0 }}>{c.name}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#6B7280", fontSize: 12 }}>
                {initial.currency || "KES"}
                <input type="number" min="0" step="1" value={prices[c.id] ?? ""} placeholder="No price" onChange={(e) => setPrices((p) => ({ ...p, [c.id]: e.target.value }))} style={input} />
              </span>
            </label>
          ))}
          <p style={{ margin: 0, fontSize: 11.5, color: "#9CA3AF" }}>A course left without a price can’t be paid for online — a learner starting there is told to enquire.</p>
        </div>
      )}
      {mode !== "none" && pathway.website.hubIds.length === 0 && (
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "#6B7280" }}>No hub ticked above, so families choose from the hubs that teach this pathway’s curriculum (or every active hub if none do) before paying. Tick hubs to choose them yourself.</p>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
        <button type="button" className="stg-btn-primary" disabled={isPending} onClick={submit}>{isPending ? "Saving…" : "Save price"}</button>
      </div>
    </div>
  );
}

// The pathway on the website: shown or not, its picture, and the hubs it runs at — the website lists
// them and the family picks one when they enrol. Hubs already teaching one of the pathway's
// curricula come first.
function WebsiteSettings({ pathway, hubs }) {
  const { mutate: save, isPending } = useSetPathwayWebsite();
  const [visible, setVisible] = useState(pathway.website.visible);
  const [hubIds, setHubIds] = useState(pathway.website.hubIds);
  const [image, setImage] = useState(pathway.website.image || "");
  const curriculumIds = new Set(pathway.curricula.map((c) => c.curriculumId));
  const teaches = (h) => h.curriculumIds.some((id) => curriculumIds.has(id));
  const ordered = [...hubs].sort((a, b) => Number(teaches(b)) - Number(teaches(a)) || a.name.localeCompare(b.name));
  const dirty = visible !== pathway.website.visible || image !== (pathway.website.image || "") || hubIds.length !== pathway.website.hubIds.length || hubIds.some((id) => !pathway.website.hubIds.includes(id));
  const toggleHub = (id) => setHubIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  return (
    <div className="stg-course-section" onClick={(e) => e.stopPropagation()}>
      <div className="stg-course-header">
        <div className="stg-course-header-left">
          <FiGlobe size={13} strokeWidth={2} style={{ color: "#25476a", flexShrink: 0 }} />
          <span className="stg-course-title">On the website</span>
        </div>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#111827", cursor: "pointer", marginTop: 6 }}>
        <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
        Show this pathway on the website
      </label>
      {visible && (
        <div style={{ marginTop: 10 }}>
          <ImageUploadField
            label="Picture (optional)"
            value={image}
            onChange={(url) => setImage(url || "")}
            width="240px"
            height="150px"
            cropAspect={16 / 10}
            guide="Shown on the pathway's card and page. Without one, the website uses its first course's cover."
          />
        </div>
      )}
      {visible && (
        <div style={{ marginTop: 10 }}>
          <p style={{ margin: "0 0 6px", fontSize: 12, color: "#6B7280" }}>
            Where it runs — families choose one of these when they enrol. {hubIds.length === 0 && "With none ticked, they pick from every hub."}
          </p>
          {ordered.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF", fontStyle: "italic" }}>No active hubs yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 6, gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
              {ordered.map((h) => (
                <label key={h.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", borderRadius: 10, border: `1.5px solid ${hubIds.includes(h.id) ? "#38aae1" : "#E5E7EB"}`, backgroundColor: hubIds.includes(h.id) ? "#F0F9FF" : "#fff", cursor: "pointer" }}>
                  <input type="checkbox" checked={hubIds.includes(h.id)} onChange={() => toggleHub(h.id)} style={{ marginTop: 2 }} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#111827" }}>{h.name}</span>
                    <span style={{ display: "block", fontSize: 11.5, color: "#6B7280" }}>
                      {h.town || (h.deliveryMode === "virtual" ? "Online" : "No town set")}
                      {teaches(h) && <span style={{ color: "#047857", fontWeight: 700 }}> · teaches this curriculum</span>}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
        <button type="button" className="stg-btn-primary" disabled={!dirty || isPending}
          onClick={() => save({ id: pathway.templateId, data: { visible, hubIds, image: image || null } })}>
          {isPending ? "Saving…" : "Save"}
        </button>
      </div>
      {pathway.website.visible && <PricingSettings pathway={pathway} />}
    </div>
  );
}

function PathwayCard({ pathway, hubs }) {
  const color = pathway.color || "#25476a";
  const [open, setOpen] = useState(false);
  const curricula = pathway.curricula.length;
  return (
    <div className="stg-item">
      <div className="stg-item-top" style={{ cursor: "pointer" }} onClick={() => setOpen((v) => !v)}>
        <div className="stg-item-dot" style={{ backgroundColor: color }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="stg-item-name">{pathway.name}</div>
          <div style={{ fontSize: 11.5, color: "#9CA3AF", marginTop: 2 }}>
            {pathway.inUse
              ? `${curricula} curricul${curricula === 1 ? "um" : "a"} · ${pathway.courseCount} course${pathway.courseCount === 1 ? "" : "s"} · ${pathway.learnerCount} learner${pathway.learnerCount === 1 ? "" : "s"}`
              : `${pathway.courseCount} course${pathway.courseCount === 1 ? "" : "s"} · not in any curriculum`}
          </div>
        </div>
        <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", ...(pathway.inUse ? { color: "#047857", backgroundColor: "#ECFDF5", border: "1px solid #A7F3D0" } : { color: "#6B7280", backgroundColor: "#F3F4F6", border: "1px solid #E5E7EB" }) }}>
          {pathway.inUse ? "In use" : "Not in use"}
        </span>
        {pathway.inUse && pathway.website.visible && (
          <span title={pathway.website.hubIds.length ? `On the website · ${pathway.website.hubIds.length} hub${pathway.website.hubIds.length === 1 ? "" : "s"}` : "On the website"}
            style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700, color: "#2e7db5", backgroundColor: "#E8F5FB", border: "1px solid #A8D5EE", whiteSpace: "nowrap" }}>
            <FiGlobe size={10} /> Website{pathway.website.hubIds.length ? ` · ${pathway.website.hubIds.length}` : ""}
          </span>
        )}
        <FiChevronDown size={14} strokeWidth={2} style={{ color: "#9CA3AF", flexShrink: 0, transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "none" }} />
      </div>

      {open && (
        <div style={{ marginTop: 8 }}>
          {!isEmptyHtml(pathway.description) && <div className="stg-item-sub"><RichContent html={pathway.description} /></div>}

          {pathway.inUse && pathway.templateId && <WebsiteSettings pathway={pathway} hubs={hubs} />}
          {pathway.inUse ? (
            pathway.curricula.map((c) => (
              <div key={c.curriculumId} className="stg-course-section">
                <div className="stg-course-header">
                  <div className="stg-course-header-left">
                    <FiBookOpen size={13} strokeWidth={2} style={{ color, flexShrink: 0 }} />
                    <span className="stg-course-title">{c.curriculumName}</span>
                  </div>
                  <Link to={`/curriculum/${c.curriculumId}/competencies?section=pathways`} onClick={(e) => e.stopPropagation()}
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: "#2e7db5", textDecoration: "none" }}>
                    Open in curriculum <FiExternalLink size={12} />
                  </Link>
                </div>
                {c.stages.map((s, i) => (
                  <div key={i} style={{ marginTop: 6 }}>
                    {(c.stages.length > 1 || s.stageName) && (
                      <p style={{ margin: "6px 0 2px", fontSize: 11.5, fontWeight: 700, color: "#6B7280" }}>{s.stageName || "No stage"}{ages(s)}</p>
                    )}
                    <CourseList courses={s.courses} color={color} />
                  </div>
                ))}
              </div>
            ))
          ) : (
            <div className="stg-course-section">
              <div className="stg-course-header">
                <div className="stg-course-header-left">
                  <FiBookOpen size={13} strokeWidth={2} style={{ color, flexShrink: 0 }} />
                  <span className="stg-course-title">Courses</span>
                </div>
              </div>
              <CourseList courses={pathway.courses || []} color={color} />
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "#6B7280" }}>
                To use it, open a curriculum → Competency Framework → Pathways and add it there.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Settings → Pathways: the workspace's pathways, to look at — the ones its curricula use (from
// Curriculum → Competency Framework → Pathways, worked out fresh each time this opens, so a change
// made in a curriculum shows here at once), each with the curricula using it, its courses per
// stage and the learners on it; then the ones no curriculum uses yet. Nothing is added, changed or
// removed here — that's done in the curriculum ("Open in curriculum").
export default function PathwayTemplatesPanel() {
  const { data, isLoading } = usePathwayDirectory();
  const pathways = data?.pathways || [];
  const hubs = data?.hubs || [];
  const [search, setSearch] = useState("");
  const [show, setShow] = useState("all");

  const query = search.trim().toLowerCase();
  const inUseCount = pathways.filter((p) => p.inUse).length;
  const filtered = pathways
    .filter((p) => show === "all" || (show === "used" ? p.inUse : !p.inUse))
    .filter((p) => !query || p.name.toLowerCase().includes(query) || p.curricula.some((c) => c.curriculumName.toLowerCase().includes(query)));

  if (isLoading) return <div className="stg-spinner" />;

  const tab = (key, label) => (
    <button type="button" onClick={() => setShow(key)}
      style={{ padding: "6px 12px", borderRadius: 20, border: `1.5px solid ${show === key ? "#25476a" : "#E5E7EB"}`, backgroundColor: show === key ? "#25476a" : "#fff", color: show === key ? "#fff" : "#374151", fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
      {label}
    </button>
  );

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0F2645" }}>Pathways</h2>
        <p style={{ margin: "3px 0 0", fontSize: 12, color: "#9CA3AF", lineHeight: 1.5 }}>
          {inUseCount} in use in your curricula, {pathways.length - inUseCount} not in use. To add, change or remove a pathway, open the curriculum
          (Competency Framework → Pathways) — changes made there show here straight away. Open a pathway to choose whether the website shows it, and at which hubs.
        </p>
      </div>

      {pathways.length === 0 ? (
        <div className="stg-empty">
          <div style={{ marginBottom: 12, color: "#25476a" }}><FiFolder size={40} strokeWidth={1.8} /></div>
          <p style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800, color: "#374151" }}>No pathways yet</p>
          <p style={{ margin: 0, fontSize: 13, color: "#9CA3AF", maxWidth: 360, marginInline: "auto", lineHeight: 1.6 }}>
            Pathways are added in a curriculum: Curriculum → Competency Framework → Pathways.
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
            {tab("all", `All (${pathways.length})`)}
            {tab("used", `In use (${inUseCount})`)}
            {tab("unused", `Not in use (${pathways.length - inUseCount})`)}
          </div>
          <div className="stg-search-wrap">
            <FiSearch size={14} className="stg-search-icon" />
            <input className="stg-search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search pathways or curricula…" />
          </div>
          {filtered.length === 0 ? (
            <div className="stg-empty" style={{ padding: "40px 24px" }}>
              <div style={{ marginBottom: 10, color: "#25476a" }}><FiSearch size={32} strokeWidth={1.8} /></div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#374151" }}>No pathways match</p>
            </div>
          ) : (
            <div className="stg-list">
              {filtered.map((pw) => <PathwayCard key={pw.key} pathway={pw} hubs={hubs} />)}
            </div>
          )}
          <p style={{ margin: "12px 0 0", fontSize: 11.5, color: "#9CA3AF", display: "flex", alignItems: "center", gap: 5 }}>
            <FiUsers size={12} /> Learners counts each learner on the pathway once, across every curriculum.
          </p>
        </>
      )}
    </div>
  );
}
