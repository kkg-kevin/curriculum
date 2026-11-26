import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiAlertTriangle, FiCalendar, FiCheck, FiEdit3, FiEye, FiImage, FiMail, FiMapPin, FiPaperclip, FiSearch, FiSend, FiStar, FiUsers, FiX } from "react-icons/fi";
import { BRAND, FONT, pill } from "../../../theme/brand";
import { Modal } from "../../connect/components/kit";
import { askConfirm } from "../../../components/ui/AskDialog";
import RichTextEditor from "../../assessments/components/RichTextEditor";
import { uploadApi } from "../../../services/uploadApi";
import AnnouncementView from "./AnnouncementView";
import { GROUP_LOOK, people, useWide } from "./ui";
import { announcementsApi, errorOf, when } from "../services/announcementsApi";

// "New announcement" (Connect, the banner's button — 26 Nov 2026). The team decides everything about
// the post in four steps — what it says, who gets it, how they can respond, when it goes out — and
// sees it as people will while writing (a live preview beside the form on a computer; a Preview
// switch on a phone). Every group shows how many people it would reach before it's ticked; hub and
// class lists can be searched. Sending asks once more with a summary; closing with changes asks
// before throwing them away. Editing a sent one changes its content and engagement only.

const field = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 12, border: `1.5px solid ${BRAND.border}`, fontSize: 15, fontFamily: FONT, color: BRAND.ink, background: "#fff" };
const lbl = { display: "grid", gap: 6, fontSize: 13, fontWeight: 800, color: BRAND.inkSoft, minWidth: 0 };
const muted = { fontWeight: 500, color: BRAND.muted };
const btn = (kind = "ghost", extra = {}) => ({ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 42, padding: "9px 16px", borderRadius: 12, border: kind === "primary" ? "none" : `1.5px solid ${BRAND.border}`, background: kind === "primary" ? BRAND.navy : "#fff", color: kind === "primary" ? "#fff" : BRAND.inkSoft, fontSize: 14, fontWeight: 800, fontFamily: FONT, cursor: "pointer", whiteSpace: "nowrap", ...extra });
const smallChip = (on) => ({ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 34, padding: "5px 11px", borderRadius: 999, border: `1.5px solid ${on ? BRAND.navy : BRAND.border}`, background: on ? BRAND.navy : "#fff", color: on ? "#fff" : BRAND.inkSoft, fontSize: 12.5, fontWeight: 700, fontFamily: FONT, cursor: "pointer" });

const localInput = (d) => {
  if (!d) return "";
  const x = new Date(d);
  const pad = (n) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
};
const dateInput = (d) => (d ? localInput(d).slice(0, 10) : "");

// One numbered step of the form.
function Step({ n, title, hint, done, right, children }) {
  return (
    <section style={{ display: "grid", gap: 12, padding: "16px 0", borderTop: n > 1 ? `1px solid ${BRAND.line}` : "none" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <span aria-hidden style={{ width: 26, height: 26, borderRadius: "50%", background: done ? BRAND.navy : BRAND.greyTint, color: done ? "#fff" : BRAND.muted, display: "grid", placeItems: "center", fontSize: 12.5, fontWeight: 900, flexShrink: 0 }}>{done ? <FiCheck size={13} /> : n}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4 style={{ margin: 0, fontSize: 15.5, fontWeight: 900, color: BRAND.ink }}>{title}</h4>
          {hint && <p style={{ margin: "1px 0 0", fontSize: 12.5, color: BRAND.muted }}>{hint}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

// A switch with a title and a line of explanation.
function Option({ checked, onChange, icon: Icon, title, hint, disabled }) {
  return (
    <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: disabled ? "default" : "pointer", padding: "11px 12px", borderRadius: 12, border: `1.5px solid ${checked ? BRAND.navy : BRAND.line}`, background: checked ? BRAND.navyTint : "#fff", opacity: disabled ? 0.6 : 1, minWidth: 0 }}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} style={{ width: 20, height: 20, marginTop: 1, flexShrink: 0, accentColor: BRAND.navy }} />
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 800, color: BRAND.ink }}>{Icon && <Icon size={14} />}{title}</span>
        {hint && <span style={{ display: "block", fontSize: 12.5, color: BRAND.muted, marginTop: 2, lineHeight: 1.45 }}>{hint}</span>}
      </span>
    </label>
  );
}

// A searchable list of chips (hubs, classes) with "All" / "Clear" and how many are picked.
function PickList({ title, hint, items, picked, onToggle, onSetAll, disabled }) {
  const [q, setQ] = useState("");
  const shown = items.filter((i) => !q.trim() || i.label.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div style={{ display: "grid", gap: 8, padding: 12, borderRadius: 14, border: `1px solid ${BRAND.line}`, background: BRAND.canvas }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ flex: "1 1 200px", fontSize: 13, fontWeight: 800, color: BRAND.inkSoft }}>{title} <span style={muted}>{picked.length ? `· ${picked.length} picked` : `· ${hint}`}</span></span>
        {items.length > 8 && (
          <label style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 10px", borderRadius: 10, border: `1.5px solid ${BRAND.border}`, background: "#fff", flex: "0 1 220px", minWidth: 0 }}>
            <FiSearch color={BRAND.faint} style={{ flexShrink: 0 }} />
            <input aria-label={`Search ${title.toLowerCase()}`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" style={{ border: "none", outline: "none", padding: "8px 0", fontSize: 14, fontFamily: FONT, width: "100%", minWidth: 0, background: "transparent" }} />
          </label>
        )}
        {!disabled && picked.length > 0 && <button type="button" onClick={() => onSetAll([])} style={{ ...btn("ghost", { minHeight: 34, padding: "5px 11px", fontSize: 12.5 }) }}>Clear</button>}
        {!disabled && q && shown.length > 0 && <button type="button" onClick={() => onSetAll([...new Set([...picked, ...shown.map((i) => i.id)])])} style={{ ...btn("ghost", { minHeight: 34, padding: "5px 11px", fontSize: 12.5 }) }}>Pick these {shown.length}</button>}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", maxHeight: 156, overflowY: "auto" }}>
        {shown.map((i) => { const on = picked.includes(i.id); return <button key={i.id} type="button" aria-pressed={on} disabled={disabled} onClick={() => onToggle(i.id)} style={{ ...smallChip(on), opacity: disabled ? 0.7 : 1 }}>{on && <FiCheck size={12} />}{i.label}</button>; })}
        {!shown.length && <span style={{ fontSize: 12.5, color: BRAND.muted }}>Nothing matches.</span>}
      </div>
    </div>
  );
}

const blank = {
  title: "", body: "", imageUrl: "", fileUrl: "", fileName: "", linkUrl: "", linkLabel: "",
  audience: { groups: [], hubIds: [], classIds: [] },
  allowReactions: true, allowComments: false, askAck: false,
  important: false, pinned: false, sendEmail: false,
  sendWhen: "now", publishAt: "", endsAt: "",
};

// The engagement choices as one-tap presets (still adjustable one by one).
const PRESETS = [
  ["Read only", { allowReactions: false, allowComments: false, askAck: false }],
  ["Reactions", { allowReactions: true, allowComments: false, askAck: false }],
  ["Discussion", { allowReactions: true, allowComments: true, askAck: false }],
  ["Must confirm", { allowReactions: false, allowComments: false, askAck: true }],
];

export default function AnnouncementComposer({ open, onClose, existing = null, onSaved }) {
  const qc = useQueryClient();
  const wide = useWide(1100);
  const editing = !!existing;
  const audienceLocked = editing && existing.state !== "scheduled";
  const [form, setForm] = useState(blank);
  const [mode, setMode] = useState("write"); // write | preview (phones and tablets)
  const [uploading, setUploading] = useState("");
  const initial = useRef(JSON.stringify(blank));

  useEffect(() => {
    if (!open) return;
    setMode("write");
    const start = existing ? {
      ...blank,
      title: existing.title || "", body: existing.body || "", imageUrl: existing.imageUrl || "", fileUrl: existing.fileUrl || "", fileName: existing.fileName || "",
      linkUrl: existing.linkUrl || "", linkLabel: existing.linkLabel || "",
      audience: { groups: existing.audience?.groups || [], hubIds: existing.audience?.hubIds || [], classIds: existing.audience?.classIds || [] },
      allowReactions: !!existing.allowReactions, allowComments: !!existing.allowComments, askAck: !!existing.askAck,
      important: !!existing.important, pinned: !!existing.pinned, sendEmail: !!existing.sendEmail,
      sendWhen: existing.state === "scheduled" && new Date(existing.publishAt) > new Date() ? "later" : "now",
      publishAt: localInput(existing.publishAt), endsAt: dateInput(existing.endsAt),
    } : blank;
    setForm(start);
    initial.current = JSON.stringify(start);
  }, [open, existing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setAud = (k, v) => setForm((f) => ({ ...f, audience: { ...f.audience, [k]: v } }));
  const toggleIn = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const dirty = JSON.stringify(form) !== initial.current;

  const { data: options } = useQuery({ queryKey: ["announcements", "options"], queryFn: announcementsApi.options, enabled: open });
  const groups = options?.groups || [];
  const chosen = new Set(form.audience.groups);
  const byHub = groups.some((g) => g.byHub && chosen.has(g.key));
  const byClass = groups.some((g) => g.byClass && chosen.has(g.key));
  const hubName = useMemo(() => new Map((options?.hubs || []).map((h) => [h.id, h.name])), [options]);
  const hubItems = useMemo(() => (options?.hubs || []).map((h) => ({ id: h.id, label: h.name })), [options]);
  const classItems = useMemo(() => (options?.classes || [])
    .filter((c) => !form.audience.hubIds.length || form.audience.hubIds.includes(c.hubId))
    .map((c) => ({ id: c.id, label: form.audience.hubIds.length === 1 ? c.label : `${c.label} · ${hubName.get(c.hubId) || ""}` })), [options, form.audience.hubIds, hubName]);

  // The total for what's ticked, and — for the chips — every group's size with the same hubs/classes.
  const audienceKey = JSON.stringify(form.audience);
  const { data: count, isFetching: counting } = useQuery({
    queryKey: ["announcements", "count", audienceKey],
    queryFn: () => announcementsApi.count(form.audience),
    enabled: open && !audienceLocked && form.audience.groups.length > 0,
    staleTime: 30 * 1000,
    placeholderData: (prev) => prev,
  });
  const sizesKey = JSON.stringify({ hubIds: form.audience.hubIds, classIds: form.audience.classIds });
  const { data: sizes } = useQuery({
    queryKey: ["announcements", "sizes", sizesKey],
    queryFn: () => announcementsApi.count({ groups: groups.map((g) => g.key), hubIds: form.audience.hubIds, classIds: form.audience.classIds }),
    enabled: open && !audienceLocked && groups.length > 0,
    staleTime: 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const payload = () => ({
    title: form.title, body: form.body || null, imageUrl: form.imageUrl || null, fileUrl: form.fileUrl || null, fileName: form.fileName || null,
    linkUrl: form.linkUrl || null, linkLabel: form.linkLabel || null, audience: form.audience,
    allowReactions: form.allowReactions, allowComments: form.allowComments, askAck: form.askAck,
    important: form.important, pinned: form.pinned, sendEmail: form.sendEmail,
    publishAt: form.sendWhen === "later" && form.publishAt ? new Date(form.publishAt).toISOString() : null,
    endsAt: form.endsAt ? new Date(`${form.endsAt}T23:59:00`).toISOString() : null,
  });
  const save = useMutation({
    mutationFn: () => (editing ? announcementsApi.update(existing.id, payload()) : announcementsApi.create(payload())),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["announcements"] });
      toast.success(editing ? "Changes saved" : d.state === "scheduled" ? `Scheduled for ${when(d.publishAt)}` : `Sent to ${people(d.recipientCount)}`);
      onSaved?.(d);
      onClose();
    },
    onError: (err) => toast.error(errorOf(err)),
  });

  const upload = async (kind, file) => {
    if (!file) return;
    setUploading(kind);
    try {
      if (kind === "image") set("imageUrl", await uploadApi.uploadImage(file));
      else {
        const res = await uploadApi.uploadDocument(file);
        setForm((f) => ({ ...f, fileUrl: res.url, fileName: file.name }));
      }
    } catch (err) {
      toast.error(errorOf(err, "Couldn't upload that"));
    } finally {
      setUploading("");
    }
  };

  const missing = [];
  if (!form.title.trim()) missing.push("a title");
  if (!form.audience.groups.length) missing.push("who it's for");
  if (form.linkUrl && !form.linkLabel.trim()) missing.push("the button's label");
  if (form.linkUrl && !/^https?:\/\//i.test(form.linkUrl)) missing.push("a button link starting https://");
  if (form.sendWhen === "later" && !form.publishAt) missing.push("when it goes out");
  const ready = !missing.length && !uploading;
  const total = audienceLocked ? existing.recipientCount : count?.total;
  const engagement = PRESETS.find(([, v]) => v.allowReactions === form.allowReactions && v.allowComments === form.allowComments && v.askAck === form.askAck)?.[0];

  // Once more before it goes to everyone: who, how many, and what happens.
  const submit = async () => {
    if (!ready) return;
    if (!editing || existing.state === "scheduled") {
      const later = form.sendWhen === "later" && form.publishAt;
      const groupsText = groups.filter((g) => chosen.has(g.key)).map((g) => `${GROUP_LOOK[g.key]?.label || g.label} ${count?.byGroup?.[g.key] ?? 0}`).join(" · ");
      const extras = [form.important && "it pops up when they sign in", form.sendEmail && "it's emailed too", form.askAck && "they're asked to confirm reading it"].filter(Boolean);
      const ok = await askConfirm({
        title: later ? `Schedule for ${when(new Date(form.publishAt))}?` : `Send to ${people(total)} now?`,
        message: `“${form.title.trim()}” goes to ${groupsText || "the people chosen"}.${extras.length ? ` ${extras.join(", ").replace(/^./, (c) => c.toUpperCase())}.` : ""}${!later ? " Everyone gets a notification straight away." : ""}`,
        confirmLabel: later ? "Schedule it" : "Send now",
      });
      if (!ok) return;
    }
    save.mutate();
  };

  const close = async () => {
    if (dirty && !save.isPending && !(await askConfirm({ title: "Discard this announcement?", message: "What you've written so far will be lost.", confirmLabel: "Discard", cancelLabel: "Keep writing", tone: "danger" }))) return;
    onClose();
  };

  const preview = {
    ...form, state: "live", authorName: "Digifunzi team", publishedAt: form.sendWhen === "later" && form.publishAt ? new Date(form.publishAt).toISOString() : new Date().toISOString(),
    endsAt: form.endsAt ? `${form.endsAt}T23:59:00` : null, can: {}, reactions: {}, comments: [],
  };

  const formView = (
    <div style={{ display: "grid", fontFamily: FONT, minWidth: 0 }}>
      <Step n={1} title="What it says" done={!!form.title.trim()}>
        <label style={lbl}>
          <span style={{ display: "flex", justifyContent: "space-between" }}><span>Title</span><span style={{ ...muted, fontSize: 12 }}>{form.title.length}/200</span></span>
          <input style={{ ...field, fontSize: 16, fontWeight: 700 }} value={form.title} maxLength={200} onChange={(e) => set("title", e.target.value)} placeholder="e.g. December training day for all mentors" autoFocus={!editing} />
        </label>
        <div style={lbl}><span>Message</span><RichTextEditor value={form.body} onChange={(v) => set("body", v)} minHeight={130} maxHeight={320} /></div>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))" }}>
          <div style={{ display: "grid", gap: 8, padding: 12, borderRadius: 14, border: `1.5px dashed ${BRAND.border}` }}>
            {form.imageUrl ? (
              <div style={{ position: "relative" }}>
                <img src={form.imageUrl} alt="" style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 10 }} />
                <button type="button" aria-label="Remove picture" onClick={() => set("imageUrl", "")} style={{ position: "absolute", top: 6, right: 6, width: 32, height: 32, borderRadius: 9, border: "none", background: "rgba(15,23,42,0.65)", color: "#fff", cursor: "pointer", display: "grid", placeItems: "center" }}><FiX /></button>
              </div>
            ) : (
              <label style={{ ...btn("ghost", { border: "none", background: BRAND.canvas, minHeight: 60 }), cursor: "pointer" }}><FiImage size={17} /> {uploading === "image" ? "Uploading…" : "Add a picture"}<input type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={(e) => { upload("image", e.target.files?.[0]); e.target.value = ""; }} /></label>
            )}
          </div>
          <div style={{ display: "grid", gap: 8, padding: 12, borderRadius: 14, border: `1.5px dashed ${BRAND.border}`, alignContent: "center" }}>
            {form.fileUrl ? (
              <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <FiPaperclip style={{ flexShrink: 0, color: BRAND.navy }} /><span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13.5, fontWeight: 700 }}>{form.fileName}</span>
                <button type="button" aria-label="Remove file" onClick={() => setForm((f) => ({ ...f, fileUrl: "", fileName: "" }))} style={{ width: 32, height: 32, borderRadius: 9, border: "none", background: BRAND.greyTint, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}><FiX /></button>
              </span>
            ) : (
              <label style={{ ...btn("ghost", { border: "none", background: BRAND.canvas, minHeight: 60 }), cursor: "pointer" }}><FiPaperclip size={17} /> {uploading === "file" ? "Uploading…" : "Attach a file"}<input type="file" hidden onChange={(e) => { upload("file", e.target.files?.[0]); e.target.value = ""; }} /></label>
            )}
          </div>
        </div>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))" }}>
          <label style={lbl}><span>Button label <span style={muted}>(optional)</span></span><input style={field} value={form.linkLabel} maxLength={80} onChange={(e) => set("linkLabel", e.target.value)} placeholder="e.g. Register here" /></label>
          <label style={lbl}><span>Button link</span><input style={field} value={form.linkUrl} maxLength={500} onChange={(e) => set("linkUrl", e.target.value)} placeholder="https://…" inputMode="url" /></label>
        </div>
      </Step>

      <Step n={2} title="Who gets it" hint={audienceLocked ? "It has been sent, so who it's for can't change." : "Tick one or more groups. Each shows how many people it has."} done={form.audience.groups.length > 0}
        right={form.audience.groups.length > 0 && <span style={pill("strong", { fontSize: 12.5, padding: "4px 11px" })}><FiUsers size={12} /> {audienceLocked ? people(existing.recipientCount) : counting && !count ? "…" : people(total)}</span>}>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 175px), 1fr))" }} role="group" aria-label="Groups">
          {groups.map((g) => {
            const on = chosen.has(g.key);
            const look = GROUP_LOOK[g.key] || { label: g.label, Icon: FiUsers };
            const { Icon } = look;
            const n = sizes?.byGroup?.[g.key];
            return (
              <button key={g.key} type="button" aria-pressed={on} disabled={audienceLocked} onClick={() => setAud("groups", toggleIn(form.audience.groups, g.key))}
                style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: "10px 12px", minHeight: 56, borderRadius: 14, border: `1.5px solid ${on ? BRAND.navy : BRAND.border}`, background: on ? BRAND.navyTint : "#fff", cursor: audienceLocked ? "default" : "pointer", fontFamily: FONT, opacity: audienceLocked && !on ? 0.55 : 1 }}>
                <span aria-hidden style={{ width: 34, height: 34, borderRadius: 10, background: on ? BRAND.navy : BRAND.skyTint, color: on ? "#fff" : BRAND.navy, display: "grid", placeItems: "center", flexShrink: 0 }}>{on ? <FiCheck size={16} /> : <Icon size={16} />}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 800, color: BRAND.ink }}>{look.label}</span>
                  <span style={{ display: "block", fontSize: 12, color: BRAND.muted }}>{n == null ? (g.key === "learners" ? "Children's own logins" : " ") : people(n)}</span>
                </span>
              </button>
            );
          })}
        </div>
        {byHub && hubItems.length > 0 && <PickList title="Only at these hubs" hint="none picked = every hub" items={hubItems} picked={form.audience.hubIds} disabled={audienceLocked} onToggle={(id) => setForm((f) => ({ ...f, audience: { ...f.audience, hubIds: toggleIn(f.audience.hubIds, id), classIds: [] } }))} onSetAll={(ids) => setForm((f) => ({ ...f, audience: { ...f.audience, hubIds: ids, classIds: [] } }))} />}
        {byClass && classItems.length > 0 && <PickList title="Only these classes" hint="educators, parents and learners; none picked = every class" items={classItems} picked={form.audience.classIds} disabled={audienceLocked} onToggle={(id) => setAud("classIds", toggleIn(form.audience.classIds, id))} onSetAll={(ids) => setAud("classIds", ids)} />}
        {!audienceLocked && count?.learnersOnlyBell > 0 && (
          <p style={{ margin: 0, display: "flex", gap: 8, fontSize: 12.5, color: BRAND.goldText, lineHeight: 1.45 }}><FiAlertTriangle style={{ flexShrink: 0, marginTop: 2 }} /> {count.learnersOnlyBell} {count.learnersOnlyBell === 1 ? "child doesn't" : "children don't"} have Connect switched on by a parent: they get the notification only, and can't react or comment.</p>
        )}
        {!audienceLocked && form.audience.groups.length > 0 && count && count.total === 0 && <p style={{ margin: 0, fontSize: 12.5, color: BRAND.danger }}>Nobody matches yet: pick other groups, hubs or classes.</p>}
      </Step>

      <Step n={3} title="How they can respond" hint={engagement ? `Set to: ${engagement}` : "Your own mix"} done>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} role="group" aria-label="Quick choices">
          {PRESETS.map(([name, v]) => <button key={name} type="button" aria-pressed={engagement === name} onClick={() => setForm((f) => ({ ...f, ...v }))} style={smallChip(engagement === name)}>{name}</button>)}
        </div>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 210px), 1fr))" }}>
          <Option checked={form.allowReactions} onChange={(v) => set("allowReactions", v)} title="Reactions" hint="Like, love, celebrate…" />
          <Option checked={form.allowComments} onChange={(v) => set("allowComments", v)} title="Comments" hint="Each group in its own thread: parents never see children's." />
          <Option checked={form.askAck} onChange={(v) => set("askAck", v)} title="“I've read this”" hint="See who hasn't confirmed yet." />
        </div>
      </Step>

      <Step n={4} title="When and how it goes out" done={form.sendWhen === "now" || !!form.publishAt}>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))" }}>
          {!audienceLocked && (
            <div style={lbl}>
              <span>Goes out</span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button type="button" aria-pressed={form.sendWhen === "now"} onClick={() => set("sendWhen", "now")} style={smallChip(form.sendWhen === "now")}><FiSend size={12} /> Now</button>
                <button type="button" aria-pressed={form.sendWhen === "later"} onClick={() => set("sendWhen", "later")} style={smallChip(form.sendWhen === "later")}><FiCalendar size={12} /> Later</button>
              </div>
              {form.sendWhen === "later" && <input type="datetime-local" aria-label="Goes out on" value={form.publishAt} min={localInput(new Date())} onChange={(e) => set("publishAt", e.target.value)} style={field} />}
            </div>
          )}
          <label style={lbl}><span>Shows until <span style={muted}>(optional, its last day)</span></span><input type="date" style={field} value={form.endsAt} min={dateInput(new Date())} onChange={(e) => set("endsAt", e.target.value)} /></label>
        </div>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 210px), 1fr))" }}>
          <Option checked={form.important} onChange={(v) => set("important", v)} icon={FiStar} title="Important" hint="Pops up when they next sign in." />
          <Option checked={form.pinned} onChange={(v) => set("pinned", v)} icon={FiMapPin} title="Pin to the top" hint="Stays first on their page." />
          <Option checked={form.sendEmail} disabled={audienceLocked} onChange={(v) => set("sendEmail", v)} icon={FiMail} title="Also email it" hint={audienceLocked ? "Already sent." : "To everyone with an email address."} />
        </div>
      </Step>
    </div>
  );

  const previewView = (
    <div style={{ display: "grid", gap: 8, alignContent: "start", minWidth: 0 }}>
      <span style={{ fontSize: 11.5, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: BRAND.muted, display: "flex", alignItems: "center", gap: 6 }}><FiEye size={12} /> How people will see it</span>
      <AnnouncementView a={preview} preview />
      {form.important && <p style={{ margin: 0, fontSize: 12.5, color: BRAND.muted }}>As it&apos;s Important, it also pops up when they next sign in.</p>}
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={close}
      width={wide ? 1180 : 760}
      title={editing ? `Edit announcement` : "New announcement"}
      footer={<>
        <span style={{ flex: wide ? "1 1 240px" : "1 1 100%", alignSelf: "center", fontSize: 13, color: missing.length ? BRAND.goldText : BRAND.muted, minWidth: 0 }}>
          {missing.length ? `Still needed: ${missing.join(", ")}.` : [people(total), engagement || "custom responses", form.important && "Important", form.sendEmail && !audienceLocked && "emailed"].filter(Boolean).join(" · ")}
        </span>
        {!wide && <button type="button" style={btn("ghost", { flex: "1 1 0" })} onClick={() => setMode(mode === "write" ? "preview" : "write")}>{mode === "write" ? <><FiEye /> Preview</> : <><FiEdit3 /> Edit</>}</button>}
        <button type="button" style={btn("primary", { opacity: ready ? 1 : 0.5, flex: wide ? "0 0 auto" : "1 1 0" })} disabled={!ready || save.isPending} onClick={submit}>
          <FiSend /> {save.isPending ? "Saving…" : editing && existing.state !== "scheduled" ? "Save changes" : form.sendWhen === "later" ? "Schedule" : `Send${total ? ` to ${total}` : ""}`}
        </button>
      </>}
    >
      {wide ? (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)", gap: 22, alignItems: "start" }}>
          {formView}
          <div style={{ position: "sticky", top: 0, paddingTop: 16 }}>{previewView}</div>
        </div>
      ) : mode === "preview" ? previewView : formView}
    </Modal>
  );
}
