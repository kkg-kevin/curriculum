import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FiAlertTriangle, FiCamera, FiCheckCircle, FiUserCheck, FiX } from "react-icons/fi";
import { BRAND, FONT, card } from "../../../theme/brand";
import { errorOf, generalEventsApi } from "../services/generalEventsApi";
import { GENERAL_EVENT_KEYS } from "../hooks/useGeneralEvents";
import { btn, inputStyle } from "../shared";

// The door's scanner (Check-in tab → Scan tickets): the phone's back camera reads a ticket's QR
// code in this same signed-in tab — the browser's own reader (BarcodeDetector) where it has one,
// else jsQR on the video frames (iPhone Safari). Each ticket found is looked up
// (GET /api/general-events/tickets/:code): valid → "Let them in" (the whole party), already in,
// waiting list / cancelled, or another of your events. A code can be typed too (no camera, a
// cracked screen, a printed ticket in bad light).
const CODE_IN_TEXT = /EV-?([A-HJ-NP-Z2-9]{6})(?![A-Z0-9])/i;
export const codeFromText = (text) => {
  const m = String(text || "").toUpperCase().match(CODE_IN_TEXT);
  return m ? `EV-${m[1]}` : null;
};

function useCamera(videoRef, active) {
  const [problem, setProblem] = useState(null);
  useEffect(() => {
    if (!active) return undefined;
    let stream = null;
    let stopped = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setProblem("This browser can't use the camera here — type the ticket code instead."); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        const video = videoRef.current;
        if (video) { video.srcObject = stream; await video.play().catch(() => {}); }
        setProblem(null);
      } catch (err) {
        setProblem(err?.name === "NotAllowedError"
          ? "Camera access was blocked. Allow the camera for this site in the browser's settings, or type the ticket code."
          : "The camera couldn't start — type the ticket code instead.");
      }
    })();
    return () => { stopped = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, [active, videoRef]);
  return problem;
}

export default function TicketScanner({ event, canLetIn, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const qc = useQueryClient();
  const [result, setResult] = useState(null); // { code, data?, error? }
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");
  const scanning = !result;
  const problem = useCamera(videoRef, true);

  const look = useCallback(async (code) => {
    setResult({ code });
    try {
      setResult({ code, data: await generalEventsApi.ticket(code) });
    } catch (err) {
      setResult({ code, error: errorOf(err) });
    }
  }, []);

  // Read frames while nothing is showing.
  useEffect(() => {
    if (!scanning) return undefined;
    let raf = 0;
    let stop = false;
    let last = 0;
    let detector = null;
    let jsQR = null;
    (async () => {
      if ("BarcodeDetector" in window) {
        try { detector = new window.BarcodeDetector({ formats: ["qr_code"] }); } catch { detector = null; }
      }
      if (!detector) jsQR = (await import("jsqr")).default;
      const tick = async (t) => {
        if (stop) return;
        const video = videoRef.current;
        if (video && video.readyState >= 2 && t - last > 220) {
          last = t;
          let text = null;
          try {
            if (detector) {
              const found = await detector.detect(video);
              text = found?.[0]?.rawValue || null;
            } else if (jsQR) {
              const canvas = canvasRef.current;
              const w = video.videoWidth;
              const h = video.videoHeight;
              if (canvas && w && h) {
                const scale = Math.min(1, 640 / Math.max(w, h));
                canvas.width = Math.round(w * scale);
                canvas.height = Math.round(h * scale);
                const ctx = canvas.getContext("2d", { willReadFrequently: true });
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
                text = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" })?.data || null;
              }
            }
          } catch { /* a frame that couldn't be read — try the next */ }
          const code = codeFromText(text);
          if (code && !stop) {
            if (navigator.vibrate) navigator.vibrate(60);
            look(code);
            return;
          }
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    })();
    return () => { stop = true; cancelAnimationFrame(raf); };
  }, [scanning, look]);

  const letIn = async () => {
    setBusy(true);
    try {
      const data = await generalEventsApi.ticketCheckIn(result.code);
      setResult({ code: result.code, data, justIn: true });
      qc.invalidateQueries({ queryKey: GENERAL_EVENT_KEYS.registrations(data.event.id) });
      qc.invalidateQueries({ queryKey: GENERAL_EVENT_KEYS.detail(data.event.id) });
    } catch (err) {
      setResult({ ...result, error: errorOf(err) });
    } finally {
      setBusy(false);
    }
  };
  const next = () => { setResult(null); setTyped(""); };
  const submitTyped = (e) => {
    e.preventDefault();
    const code = codeFromText(typed) || codeFromText(`EV${typed.replace(/[^a-z0-9]/gi, "")}`);
    if (code) look(code);
    else setResult({ code: typed.trim().toUpperCase(), error: "That isn't a ticket code — it looks like EV-7K3M9Q." });
  };

  const d = result?.data;
  const otherEvent = d && d.event.id !== event.id;
  const tone = result?.error || (d && !d.ticket.valid) ? "bad" : otherEvent ? "warn" : d?.ticket.used && !result?.justIn ? "used" : "good";
  const colours = { good: ["#E6F4EA", "#1E6B3A"], used: [BRAND.skyTint, BRAND.navy], warn: ["#FFF5DB", BRAND.goldText], bad: ["#FDECEC", BRAND.danger] }[tone];

  return (
    <div role="dialog" aria-modal="true" aria-label="Scan tickets" style={{ position: "fixed", inset: 0, zIndex: 1500, background: "#0B1622", display: "flex", flexDirection: "column", fontFamily: FONT }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 16px", color: "#fff" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 900 }}>Scan tickets</div>
          <div style={{ fontSize: 12, opacity: 0.75, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{event.title}</div>
        </div>
        <button type="button" aria-label="Close the scanner" onClick={onClose} style={{ background: "rgba(255,255,255,0.12)", color: "#fff", border: "none", borderRadius: 10, width: 40, height: 40, flexShrink: 0, cursor: "pointer", display: "grid", placeItems: "center" }}><FiX size={20} /></button>
      </div>

      <div style={{ position: "relative", flex: 1, minHeight: 0, overflow: "hidden" }}>
        <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", display: problem ? "none" : "block" }} />
        <canvas ref={canvasRef} style={{ display: "none" }} />
        {!problem && scanning && (
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}>
            <div style={{ width: "min(64vw, 280px)", aspectRatio: "1", borderRadius: 18, boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)", border: "3px solid rgba(255,255,255,0.9)" }} />
          </div>
        )}
        {problem && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 24, color: "#fff", textAlign: "center" }}>
            <div style={{ display: "grid", gap: 10, justifyItems: "center", maxWidth: 320 }}>
              <FiCamera size={30} />
              <div style={{ fontSize: 14, lineHeight: 1.5 }}>{problem}</div>
            </div>
          </div>
        )}
        {scanning && !problem && <div style={{ position: "absolute", left: 0, right: 0, bottom: 14, textAlign: "center", color: "#fff", fontSize: 13, fontWeight: 700, textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>Point at the QR code on their ticket</div>}

        {result && (
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 12 }}>
            <div style={{ ...card, padding: 0, overflow: "hidden", maxWidth: 480, margin: "0 auto" }}>
              <div style={{ background: colours[0], color: colours[1], padding: "14px 16px", display: "flex", gap: 10, alignItems: "center" }}>
                {tone === "bad" || tone === "warn" ? <FiAlertTriangle size={24} /> : <FiCheckCircle size={24} />}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.2 }}>
                    {!d && !result.error ? "Checking…" : result.error ? "Can't let in" : result.justIn ? "Checked in — welcome!" : otherEvent ? "A ticket for another event" : d.ticket.label}
                  </div>
                  <div style={{ fontSize: 12, fontFamily: "Consolas, monospace", fontWeight: 700, letterSpacing: "0.08em", opacity: 0.85 }}>{result.code}</div>
                </div>
              </div>
              <div style={{ padding: "12px 16px 16px", display: "grid", gap: 8 }}>
                {result.error && <div style={{ fontSize: 14, color: BRAND.inkSoft }}>{result.error}</div>}
                {d && (
                  <>
                    <div style={{ fontSize: 20, fontWeight: 900, color: BRAND.ink }}>{d.registration.name}</div>
                    <div style={{ fontSize: 13.5, color: BRAND.inkSoft }}>Admits {d.registration.partySize}{otherEvent ? ` · ${d.event.title} (${d.event.when})` : ""}</div>
                  </>
                )}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                  {d && canLetIn && d.ticket.valid && !d.ticket.used && !otherEvent && (
                    <button type="button" onClick={letIn} disabled={busy} style={btn("primary", { minHeight: 48, flex: 1, justifyContent: "center", fontSize: 15 })}>
                      <FiUserCheck size={17} /> {busy ? "Checking in…" : `Let ${d.registration.partySize === 1 ? "them" : `all ${d.registration.partySize}`} in`}
                    </button>
                  )}
                  <button type="button" onClick={next} style={btn(d && d.ticket.valid && !d.ticket.used && !otherEvent && canLetIn ? "plain" : "primary", { minHeight: 48, flex: 1, justifyContent: "center" })}>Scan the next ticket</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={submitTyped} style={{ display: "flex", gap: 8, padding: 12, background: "#0B1622" }}>
        <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Or type a code, e.g. EV-7K3M9Q" aria-label="Ticket code" autoCapitalize="characters" style={{ ...inputStyle, flex: 1, minWidth: 0 }} />
        <button type="submit" style={btn("gold", { minHeight: 44 })} disabled={!typed.trim()}>Check</button>
      </form>
    </div>
  );
}
