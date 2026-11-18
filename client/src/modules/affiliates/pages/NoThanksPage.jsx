import { useState } from "react";
import { useParams } from "react-router-dom";
import { FiCheckCircle, FiMail } from "react-icons/fi";
import { BRAND, FONT, HERO_GRADIENT } from "../../../theme/brand";
import { affiliatesApi, errorOf } from "../services/affiliatesApi";

// The "no thanks" link in an affiliate's invite (/no-thanks/:token, no sign-in): the family asks
// not to be contacted — their pre-registration closes and their details are removed (server
// affiliate.prospects.js's optOut). It asks first, so a link-checking mail scanner can't do it
// for them.
export default function NoThanksPage() {
  const { token } = useParams();
  const [state, setState] = useState("ask"); // ask | busy | done | error
  const [message, setMessage] = useState("");
  const confirm = async () => {
    setState("busy");
    try {
      await affiliatesApi.optOut(token);
      setState("done");
    } catch (err) {
      setMessage(errorOf(err, "This link isn't working."));
      setState("error");
    }
  };
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: BRAND.canvas, padding: 16, fontFamily: FONT }}>
      <main style={{ width: "100%", maxWidth: 460, background: "#fff", borderRadius: 20, border: `1.5px solid ${BRAND.border}`, overflow: "hidden", boxShadow: "0 12px 32px rgba(15,23,42,0.08)" }}>
        <div style={{ background: HERO_GRADIENT, padding: "22px 24px", color: "#fff", display: "flex", gap: 12, alignItems: "center" }}>
          {state === "done" ? <FiCheckCircle size={26} /> : <FiMail size={26} />}
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>{state === "done" ? "Done — we won't contact you" : "Stop hearing from Digifunzi?"}</h1>
        </div>
        <div style={{ padding: 24, display: "grid", gap: 14 }}>
          {state === "done" ? (
            <p style={{ margin: 0, fontSize: 14.5, color: BRAND.inkSoft, lineHeight: 1.6 }}>We&rsquo;ve removed your details from the list you were added to, and we won&rsquo;t contact you about it again. You&rsquo;re always welcome to sign up yourself one day.</p>
          ) : state === "error" ? (
            <p style={{ margin: 0, fontSize: 14.5, color: BRAND.danger, lineHeight: 1.6 }}>{message}</p>
          ) : (
            <>
              <p style={{ margin: 0, fontSize: 14.5, color: BRAND.inkSoft, lineHeight: 1.6 }}>Someone you spoke to shared your details with us so we could tell you about Digifunzi. If you&rsquo;d rather not hear from us, confirm below and we&rsquo;ll remove them.</p>
              <button type="button" onClick={confirm} disabled={state === "busy"} style={{ padding: "12px 18px", borderRadius: 12, border: 0, background: BRAND.navy, color: "#fff", fontWeight: 800, fontSize: 15, fontFamily: FONT, cursor: "pointer" }}>
                {state === "busy" ? "One moment…" : "Yes, don't contact me"}
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
