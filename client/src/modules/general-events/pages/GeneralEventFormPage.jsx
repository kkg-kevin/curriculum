import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FiArrowLeft, FiCalendar, FiEye, FiGlobe, FiMapPin, FiMonitor, FiSave, FiUsers } from "react-icons/fi";
import toast from "react-hot-toast";
import ImageUploadField from "../../../components/ImageUploadField";
import PhotoGalleryField from "../../learning-hubs/components/PhotoGalleryField";
import { Editor as RichTextEditor } from "../../courses/components/RichTextEditor";
import { BRAND, FONT, card, cardHeading } from "../../../theme/brand";
import { errorOf, generalEventsApi } from "../services/generalEventsApi";
import { GENERAL_EVENT_KEYS, useGeneralEvent, useGeneralEventOptions } from "../hooks/useGeneralEvents";
import { useQueryClient } from "@tanstack/react-query";
import { EVENTS_CSS, btn, hintStyle, inputStyle, labelStyle } from "../shared";

// Make or change a general event (/events/general/create, /events/general/:id/edit). Save as a
// draft (nobody sees it) or publish (on the website if chosen, and the pop-ups start).
const EMPTY = {
  title: "", kind: "showcase", tagline: "", description: "", coverImage: "", images: [],
  startDate: "", startTime: "10:00", endDate: "", endTime: "13:00",
  format: "in_person", hubId: "", venueName: "", venueAddress: "", mapUrl: "", meetingLink: "",
  bootcampId: "", capacity: "", waitlistOn: true, maxPartySize: 5, registrationOpen: true, registrationClosesOn: "", askAboutYou: true,
  isPublic: true, websitePopup: true, systemPopup: true, systemAudience: null, popupFrom: "", popupUntil: "",
  ageMin: "", ageMax: "", highlightsText: "",
};

function Section({ icon: Icon, title, hint, children }) {
  return (
    <section style={{ ...card, padding: 20, display: "grid", gap: 14 }}>
      <div>
        <h2 style={cardHeading}><Icon size={13} /> {title}</h2>
        {hint && <p style={{ ...hintStyle, margin: "6px 0 0" }}>{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: 18, height: 18, marginTop: 2, accentColor: BRAND.navy, flexShrink: 0 }} />
      <span style={{ display: "grid", gap: 2 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: BRAND.ink }}>{label}</span>
        {hint && <span style={hintStyle}>{hint}</span>}
      </span>
    </label>
  );
}

function Segmented({ value, onChange, options }) {
  return (
    <div className="ge-row" role="group">
      {options.map(([key, label, Icon]) => (
        <button key={key} type="button" className="ge-chip" aria-pressed={value === key} onClick={() => onChange(key)}>
          {Icon && <Icon size={13} />} {label}
        </button>
      ))}
    </div>
  );
}

const fromEvent = (e) => ({
  ...EMPTY,
  ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, e[k] ?? EMPTY[k]])),
  capacity: e.capacity ?? "",
  images: e.images || [],
  systemAudience: e.systemAudience || null,
  ageMin: e.ageMin ?? "", ageMax: e.ageMax ?? "",
  // The page's own "What to expect" lines, one per line (not the kind's defaults it shows otherwise).
  highlightsText: e.public?.ownHighlights ? (e.public.highlights || []).join("\n") : "",
});

export default function GeneralEventFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: existing, isLoading } = useGeneralEvent(id);
  const { data: options } = useGeneralEventOptions();
  const [form, setForm] = useState(EMPTY);
  const [multiDay, setMultiDay] = useState(false);
  const [venueMode, setVenueMode] = useState("hub");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setForm(fromEvent(existing));
    setMultiDay(Boolean(existing.endDate));
    setVenueMode(existing.hubId ? "hub" : "other");
  }, [existing]);
  useEffect(() => {
    if (!editing && options && options.hubs.length === 0) setVenueMode("other");
  }, [editing, options]);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const field = (key) => ({ value: form[key] ?? "", onChange: (e) => set(key)(e.target.value) });
  const groups = options?.audienceGroups || {};
  const everyone = !form.systemAudience || form.systemAudience.length === 0;
  const toggleGroup = (g) => setForm((f) => {
    const current = f.systemAudience && f.systemAudience.length ? f.systemAudience : Object.keys(groups);
    const next = current.includes(g) ? current.filter((x) => x !== g) : [...current, g];
    return { ...f, systemAudience: next.length === Object.keys(groups).length ? null : next };
  });
  const hub = useMemo(() => options?.hubs.find((h) => h.id === form.hubId) || null, [options, form.hubId]);
  const published = existing?.status === "published";

  const save = async (status) => {
    if (!form.title.trim()) return toast.error("Give the event a name");
    if (!form.startDate) return toast.error("Pick the day it's on");
    if (form.format !== "online" && venueMode === "hub" && !form.hubId) return toast.error("Pick the hub it's at — or choose “Somewhere else”");
    if (form.format !== "online" && venueMode === "other" && !form.venueName.trim()) return toast.error("Type where it is");
    if (form.format !== "in_person" && !form.meetingLink.trim()) return toast.error("Add the link people join with");
    const body = {
      ...form,
      status,
      endDate: multiDay ? form.endDate || null : null,
      hubId: venueMode === "hub" && form.format !== "online" ? form.hubId || null : null,
      venueName: venueMode === "other" || !form.hubId ? form.venueName : form.venueName || null,
      capacity: form.capacity === "" ? null : Number(form.capacity),
      maxPartySize: Number(form.maxPartySize) || 5,
      bootcampId: form.bootcampId || null,
      ageMin: form.ageMin === "" ? null : Number(form.ageMin),
      ageMax: form.ageMax === "" ? null : Number(form.ageMax),
      highlights: String(form.highlightsText || "").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 8),
    };
    delete body.highlightsText;
    setSaving(true);
    try {
      const saved = editing ? await generalEventsApi.update(id, body) : await generalEventsApi.create(body);
      qc.invalidateQueries({ queryKey: GENERAL_EVENT_KEYS.all });
      qc.invalidateQueries({ queryKey: GENERAL_EVENT_KEYS.detail(saved.id) });
      toast.success(status === "published" ? (published ? "Saved" : "Published — it's live") : "Saved as a draft");
      navigate(`/events/general/${saved.id}`);
    } catch (err) {
      toast.error(errorOf(err));
    } finally {
      setSaving(false);
    }
  };

  if (editing && isLoading) return <p style={{ fontFamily: FONT, color: BRAND.muted }}>Loading…</p>;

  return (
    <div className="ge-page" style={{ maxWidth: 980, margin: "0 auto", paddingBottom: 90 }}>
      <style>{EVENTS_CSS}</style>
      <div>
        <Link to={editing ? `/events/general/${id}` : "/events#general"} style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13, fontWeight: 700, color: BRAND.mid, textDecoration: "none" }}>
          <FiArrowLeft size={14} /> {editing ? "Back to the event" : "Events"}
        </Link>
        <h1 style={{ margin: "8px 0 4px", fontSize: 26, fontWeight: 900, color: BRAND.ink, letterSpacing: "-0.4px" }}>{editing ? "Edit event" : "New event"}</h1>
        <p style={{ margin: 0, fontSize: 13.5, color: BRAND.muted }}>Free to attend. People register with their name, phone and email — the rest is optional.</p>
      </div>

      <Section icon={FiCalendar} title="The event">
        <label style={labelStyle}>Name
          <input style={inputStyle} {...field("title")} placeholder="E.g. December Bootcamp Showcase" maxLength={200} />
        </label>
        <div style={labelStyle}>What kind
          <Segmented value={form.kind} onChange={set("kind")} options={Object.entries(options?.kinds || { showcase: "Showcase" }).map(([k, v]) => [k, v])} />
        </div>
        <label style={labelStyle}>One line about it
          <input style={inputStyle} {...field("tagline")} placeholder="E.g. Come and see what our young coders built this holiday" maxLength={300} />
          <span style={hintStyle}>Shown on the pop-ups and event cards.</span>
        </label>
        <div style={labelStyle}>Details
          <RichTextEditor value={form.description || ""} onChange={set("description")} size="sm" />
          <span style={hintStyle}>What happens, who it&rsquo;s for, what to bring.</span>
        </div>
        <div className="ge-grid-3">
          <label style={labelStyle}>Youngest age (optional)<input type="number" min={1} max={99} style={inputStyle} {...field("ageMin")} placeholder="Any" /></label>
          <label style={labelStyle}>Oldest age (optional)<input type="number" min={1} max={99} style={inputStyle} {...field("ageMax")} placeholder="Any" /></label>
          <span style={{ ...hintStyle, alignSelf: "end", paddingBottom: 10 }}>Shown as &ldquo;For ages 6–14&rdquo; — parents look for it first.</span>
        </div>
        <label style={labelStyle}>What to expect (one per line, up to 8)
          <textarea rows={4} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.55 }} {...field("highlightsText")}
            placeholder={(options?.defaultHighlights?.[form.kind] || []).join("\n")} />
          <span style={hintStyle}>The reasons to come, as short lines. Left empty, the page shows the lines in grey above — written for a {(options?.kinds?.[form.kind] || "event").toLowerCase()}.</span>
        </label>
        <div className="ge-grid-2">
          <ImageUploadField label="Cover picture" value={form.coverImage || ""} onChange={set("coverImage")} width="100%" height="160px" cropAspect={16 / 9} />
          <PhotoGalleryField label="More pictures (optional)" value={form.images} onChange={set("images")} max={12} hint="Add photos after the event too — past events show them on the website." />
        </div>
      </Section>

      <Section icon={FiCalendar} title="When">
        <div className="ge-grid-3">
          <label style={labelStyle}>Day<input type="date" style={inputStyle} {...field("startDate")} /></label>
          <label style={labelStyle}>Starts<input type="time" style={inputStyle} {...field("startTime")} /></label>
          <label style={labelStyle}>Ends<input type="time" style={inputStyle} {...field("endTime")} /></label>
        </div>
        <Toggle checked={multiDay} onChange={setMultiDay} label="It runs over more than one day" />
        {multiDay && (
          <label style={{ ...labelStyle, maxWidth: 260 }}>Last day<input type="date" style={inputStyle} min={form.startDate || undefined} {...field("endDate")} /></label>
        )}
      </Section>

      <Section icon={FiMapPin} title="Where">
        <Segmented value={form.format} onChange={set("format")} options={[["in_person", "In person", FiMapPin], ["online", "Online", FiMonitor], ["hybrid", "Both", FiGlobe]]} />
        {form.format !== "online" && (
          <>
            {(options?.hubs?.length || 0) > 0 && (
              <Segmented value={venueMode} onChange={setVenueMode} options={[["hub", "At one of our hubs"], ["other", "Somewhere else"]]} />
            )}
            {venueMode === "hub" && (options?.hubs?.length || 0) > 0 ? (
              <label style={labelStyle}>Hub
                <select style={inputStyle} {...field("hubId")}>
                  <option value="">Pick a hub…</option>
                  {options.hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
                {hub && <span style={hintStyle}>{hub.address ? `People see: ${hub.address}` : "This hub has no address yet — add one below or on the hub."}{hub.mapLink ? " · map link from the hub" : ""}</span>}
              </label>
            ) : (
              <label style={labelStyle}>Place<input style={inputStyle} {...field("venueName")} placeholder="E.g. Kilimani Community Hall" /></label>
            )}
            <div className="ge-grid-2">
              <label style={labelStyle}>Address{venueMode === "hub" ? " (optional — the hub's is used)" : ""}<input style={inputStyle} {...field("venueAddress")} placeholder="Street, area, town" /></label>
              <label style={labelStyle}>Map link (optional)<input style={inputStyle} {...field("mapUrl")} placeholder="https://maps.app.goo.gl/…" /></label>
            </div>
          </>
        )}
        {form.format !== "in_person" && (
          <label style={labelStyle}>Online link
            <input style={inputStyle} {...field("meetingLink")} placeholder="https://meet.google.com/…" />
            <span style={hintStyle}>Only sent to people registered — in their reminders and on their registration page the day before.</span>
          </label>
        )}
      </Section>

      <Section icon={FiUsers} title="Registration" hint="Name, phone and email are always asked. The optional “about you” step asks who they are, their children's ages, what interests them and how they heard of us.">
        <div className="ge-grid-3">
          <label style={labelStyle}>Places
            <input type="number" min={1} style={inputStyle} {...field("capacity")} placeholder="No limit" />
            <span style={hintStyle}>People, counting everyone they bring.</span>
          </label>
          <label style={labelStyle}>Most people per registration
            <input type="number" min={1} max={20} style={inputStyle} {...field("maxPartySize")} />
          </label>
          <label style={labelStyle}>Registration closes (optional)
            <input type="date" style={inputStyle} {...field("registrationClosesOn")} />
            <span style={hintStyle}>Otherwise when it starts.</span>
          </label>
        </div>
        {form.capacity !== "" && <Toggle checked={form.waitlistOn} onChange={set("waitlistOn")} label="Keep a waiting list when it's full" hint="Places freed by cancellations go to the list in order, and each person is emailed." />}
        <Toggle checked={form.askAboutYou} onChange={set("askAboutYou")} label="Ask the optional “about you” questions" hint="Asked after they've registered, all taps — skipping them is fine." />
        {editing && <Toggle checked={form.registrationOpen} onChange={set("registrationOpen")} label="Registration is open" hint="Close it any time; the page and pop-ups say so." />}
        <label style={labelStyle}>For a bootcamp (optional)
          <select style={inputStyle} {...field("bootcampId")}>
            <option value="">Not for a bootcamp</option>
            {(options?.bootcamps || []).map((b) => <option key={b.id} value={b.id}>{b.name}{b.startDate ? ` · ${b.startDate}` : ""}</option>)}
          </select>
          <span style={hintStyle}>For a showcase: you can then email an invitation to every family of that bootcamp.</span>
        </label>
        <p style={{ ...hintStyle, margin: 0, padding: "10px 12px", borderRadius: 10, background: BRAND.canvas }}>Free to attend. Paid tickets will come later.</p>
      </Section>

      <Section icon={FiEye} title="Who sees it">
        <Toggle checked={form.isPublic} onChange={set("isPublic")} label="On the website" hint="Listed under Events with its own page anyone can register on." />
        {form.isPublic && <Toggle checked={form.websitePopup} onChange={set("websitePopup")} label="Website pop-up" hint="Visitors see it after a few seconds (never while signing up or paying), at most every few days." />}
        <Toggle checked={form.systemPopup} onChange={set("systemPopup")} label="Pop-up when people sign in to the system" hint="Until they register or say “not now”." />
        {form.systemPopup && (
          <div style={labelStyle}>Who gets the sign-in pop-up
            <div className="ge-row">
              <button type="button" className="ge-chip" aria-pressed={everyone} onClick={() => set("systemAudience")(null)}>Everyone</button>
              {Object.entries(groups).map(([g, label]) => (
                <button key={g} type="button" className="ge-chip" aria-pressed={!everyone && form.systemAudience.includes(g)} onClick={() => toggleGroup(g)}>{label}</button>
              ))}
            </div>
            <span style={hintStyle}>Children&rsquo;s own logins see the event and are asked to tell their parent — they can&rsquo;t register.</span>
          </div>
        )}
        {(form.systemPopup || (form.isPublic && form.websitePopup)) && (
          <div className="ge-grid-2">
            <label style={labelStyle}>Pop-ups from (optional)<input type="date" style={inputStyle} {...field("popupFrom")} /><span style={hintStyle}>Otherwise from publishing.</span></label>
            <label style={labelStyle}>Pop-ups until (optional)<input type="date" style={inputStyle} {...field("popupUntil")} /><span style={hintStyle}>Otherwise until the day it starts.</span></label>
          </div>
        )}
      </Section>

      <div style={{ position: "sticky", bottom: 0, zIndex: 5, display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap", padding: "12px 0", background: "linear-gradient(180deg, rgba(245,248,252,0) 0%, rgba(245,248,252,0.96) 30%)" }}>
        {!published && <button type="button" style={btn("plain")} disabled={saving} onClick={() => save("draft")}><FiSave size={14} /> Save as draft</button>}
        <button type="button" style={btn("primary", { opacity: saving ? 0.6 : 1 })} disabled={saving} onClick={() => save("published")}>
          <FiGlobe size={14} /> {saving ? "Saving…" : published ? "Save changes" : "Publish"}
        </button>
      </div>
    </div>
  );
}
