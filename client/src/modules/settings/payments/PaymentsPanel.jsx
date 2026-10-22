import { useEffect, useState } from "react";
import {
  usePaymentSettings, useSavePaymentSettings, useRemovePaymentSettings, useRegisterPaybillUrls, useTestPaymentKeys,
} from "./paymentSettingsApi";

const heading = { margin: 0, fontSize: 15, fontWeight: 800, color: "#111827" };
const subheading = { margin: "0 0 4px", fontSize: 13.5, fontWeight: 800, color: "#111827" };
const hint = { margin: "4px 0 0", fontSize: 12.5, color: "#6B7280", lineHeight: 1.5, maxWidth: 680 };
const label = { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 5 };
const grid = { display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", maxWidth: 820 };
const box = { border: "1.5px solid #E5E7EB", borderRadius: 14, padding: "16px 18px" };

const EMPTY = {
  enabled: true, environment: "sandbox", shortcode: "", accountLabel: "", initiatorName: "", b2cShortcode: "", b2cInitiatorName: "",
  consumerKey: "", consumerSecret: "", passkey: "", securityCredential: "", b2cConsumerKey: "", b2cConsumerSecret: "", b2cSecurityCredential: "",
};
const SECRETS = ["consumerKey", "consumerSecret", "passkey", "securityCredential", "b2cConsumerKey", "b2cConsumerSecret", "b2cSecurityCredential"];

function Ready({ ok, children }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: ok ? "#047857" : "#6B7280" }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: ok ? "#10B981" : "#D1D5DB" }} />{children}
    </span>
  );
}

function Text({ id, title, value, onChange, placeholder, maxLength = 100, help }) {
  return (
    <div>
      <label htmlFor={id} style={label}>{title}</label>
      <input id={id} className="stg-input" value={value} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" />
      {help && <p style={{ ...hint, marginTop: 4, fontSize: 11.5 }}>{help}</p>}
    </div>
  );
}

// A write-only field: shows whether something is saved, never what.
function Secret({ id, title, value, onChange, saved, unreadable }) {
  return (
    <div>
      <label htmlFor={id} style={label}>{title}</label>
      <input id={id} className="stg-input" type="password" value={value} onChange={(e) => onChange(e.target.value)} autoComplete="new-password"
        placeholder={saved ? "Saved — type to replace" : "Not set"} />
      {unreadable && <p style={{ ...hint, marginTop: 4, fontSize: 11.5, color: "#B91C1C" }}>Saved, but this server can no longer read it (its MPESA_SECRETS_KEY changed). Enter it again.</p>}
    </div>
  );
}

// Settings → Payments (owner only): this workspace's own M-Pesa Paybill. Without one, invoices are
// paid into the installation's Paybill (if the server has one). With one, every invoice of this
// workspace is paid into it — prompts, the Paybill number printed on invoices, Paybill payments
// and statement imports — and approved educator claims can be paid from its B2C shortcode.
export default function PaymentsPanel() {
  const { data, isLoading, isError } = usePaymentSettings();
  const { mutate: save, isPending: saving } = useSavePaymentSettings();
  const { mutate: remove, isPending: removing } = useRemovePaymentSettings();
  const { mutate: register, isPending: registering } = useRegisterPaybillUrls();
  const test = useTestPaymentKeys();
  const [form, setForm] = useState(EMPTY);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const account = data?.account;
  useEffect(() => {
    if (!data) return;
    const a = data.account;
    setForm(a ? {
      ...EMPTY, enabled: a.enabled, environment: a.environment, shortcode: a.shortcode, accountLabel: a.accountLabel,
      initiatorName: a.initiatorName, b2cShortcode: a.b2cShortcode, b2cInitiatorName: a.b2cInitiatorName,
    } : EMPTY);
    if (a && (a.initiatorName || a.b2cShortcode)) setShowAdvanced(true);
  }, [data]);

  const set = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));
  const submit = (e) => {
    e.preventDefault();
    const body = { ...form };
    // An empty secret keeps what's saved.
    for (const field of SECRETS) if (!body[field]) delete body[field];
    save(body, { onSuccess: () => setForm((f) => ({ ...f, ...Object.fromEntries(SECRETS.map((s) => [s, ""])) })) });
  };
  const registerUrls = () => {
    const production = account?.environment === "production";
    const message = production
      ? `Register these URLs for Paybill ${account.shortcode}?\n\nIn production Safaricom keeps the FIRST URLs registered for a Paybill. Changing them later means asking Safaricom to delete them.\n\nConfirmation: ${account.urls.confirmation}`
      : `Register the Paybill URLs for ${account.shortcode} (sandbox)?`;
    if (window.confirm(message)) register();
  };

  if (isLoading) return <p style={hint}>Loading…</p>;
  if (isError || !data) return <p style={{ ...hint, color: "#B91C1C" }}>Payment settings could not be loaded.</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      <section>
        <h2 style={heading}>M-Pesa Paybill</h2>
        <p style={hint}>
          Families pay this workspace's invoices into this Paybill: by the prompt on their phone, or from the M-Pesa menu with the invoice's account number. Leave it empty to use {data.installation.enabled ? <>this server's Paybill (<strong>{data.installation.paybill}</strong>)</> : "this server's Paybill — which isn't set up, so M-Pesa is off until you add yours"}.
        </p>
        {!data.canSaveSecrets && (
          <p style={{ ...hint, color: "#B45309" }}>This server can't store M-Pesa keys yet: MPESA_SECRETS_KEY must be set on it first.</p>
        )}
        {!data.callbackBaseOk && (
          <p style={{ ...hint, color: "#B45309" }}>Safaricom can't reach this server yet: API_PUBLIC_URL (or MPESA_CALLBACK_BASE_URL) must be a public https address.</p>
        )}
      </section>

      {account && (
        <section style={{ ...box, display: "flex", flexDirection: "column", gap: 10, maxWidth: 820 }}>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <Ready ok={account.enabled && account.ready.prompts}>{account.enabled ? (account.ready.prompts ? "Taking payments" : "Not ready — keys missing") : "Not in use"}</Ready>
            <Ready ok={account.ready.checks}>Checks and reversals</Ready>
            <Ready ok={account.ready.payouts}>Paying educators</Ready>
            <Ready ok={Boolean(account.c2bRegisteredAt)}>{account.c2bRegisteredAt ? `Paybill URLs registered ${new Date(account.c2bRegisteredAt).toLocaleDateString("en-KE")}` : "Paybill URLs not registered"}</Ready>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="stg-btn-secondary" disabled={test.isPending} onClick={() => test.mutate()}>{test.isPending ? "Testing…" : "Test the keys"}</button>
            <button type="button" className="stg-btn-secondary" disabled={registering || !account.ready.prompts} onClick={registerUrls}>{registering ? "Registering…" : account.c2bRegisteredAt ? "Register Paybill URLs again" : "Register Paybill URLs"}</button>
          </div>
          {test.data?.results?.map((r) => (
            <div key={r.label} style={{ fontSize: 12.5, color: r.ok ? "#047857" : "#B91C1C" }}>{r.label}: {r.message}</div>
          ))}
          <p style={{ ...hint, fontSize: 11.5 }}>
            Registering tells Safaricom where to send payments made from the M-Pesa menu, so they're matched to invoices by themselves. Do it once, after the keys test fine. Confirmation URL: <code>{account.urls.confirmation}</code>
          </p>
        </section>
      )}

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#374151" }}>
            <input type="checkbox" checked={form.enabled} onChange={(e) => set("enabled")(e.target.checked)} />
            Use this Paybill for this workspace's invoices
          </label>
          <div style={grid}>
            <Text id="pay-shortcode" title="Paybill number" value={form.shortcode} onChange={set("shortcode")} placeholder="e.g. 123456" maxLength={10} />
            <div>
              <label htmlFor="pay-env" style={label}>Mode</label>
              <select id="pay-env" className="stg-input" value={form.environment} onChange={(e) => set("environment")(e.target.value)}>
                <option value="sandbox">Test (sandbox)</option>
                <option value="production">Live (production)</option>
              </select>
            </div>
            <Text id="pay-label" title="Name payers see" value={form.accountLabel} onChange={set("accountLabel")} placeholder="e.g. Digifunzi" />
          </div>
          <div style={grid}>
            <Secret id="pay-ck" title="Consumer key" value={form.consumerKey} onChange={set("consumerKey")} saved={account?.saved?.consumerKey} unreadable={account?.unreadable?.includes("consumerKey")} />
            <Secret id="pay-cs" title="Consumer secret" value={form.consumerSecret} onChange={set("consumerSecret")} saved={account?.saved?.consumerSecret} unreadable={account?.unreadable?.includes("consumerSecret")} />
            <Secret id="pay-pk" title="Passkey (M-Pesa Express)" value={form.passkey} onChange={set("passkey")} saved={account?.saved?.passkey} unreadable={account?.unreadable?.includes("passkey")} />
          </div>
          <p style={{ ...hint, marginTop: 0 }}>From your Daraja app (developer.safaricom.co.ke) and, for live, the passkey Safaricom emails after Go Live.</p>
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button type="button" onClick={() => setShowAdvanced((v) => !v)} style={{ alignSelf: "flex-start", border: 0, background: "transparent", color: "#25476a", fontWeight: 700, fontSize: 13, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
            {showAdvanced ? "Hide" : "Show"} checks, reversals and paying educators
          </button>
          {showAdvanced && (
            <>
              <div>
                <h3 style={subheading}>Checking and reversing payments</h3>
                <p style={{ ...hint, marginTop: 0 }}>The Paybill's API operator (“initiator”), created in the M-Pesa business portal. Lets staff ask M-Pesa about a payment, and send money that's on no invoice back to the payer.</p>
              </div>
              <div style={grid}>
                <Text id="pay-init" title="Initiator name" value={form.initiatorName} onChange={set("initiatorName")} />
                <Secret id="pay-cred" title="Security credential" value={form.securityCredential} onChange={set("securityCredential")} saved={account?.saved?.securityCredential} unreadable={account?.unreadable?.includes("securityCredential")} />
              </div>
              <div style={{ marginTop: 6 }}>
                <h3 style={subheading}>Paying educators (B2C)</h3>
                <p style={{ ...hint, marginTop: 0 }}>A disbursement shortcode to pay approved claims from. Anything left empty uses the Paybill's values above.</p>
              </div>
              <div style={grid}>
                <Text id="pay-b2c" title="B2C shortcode" value={form.b2cShortcode} onChange={set("b2cShortcode")} maxLength={10} />
                <Secret id="pay-b2c-ck" title="B2C consumer key" value={form.b2cConsumerKey} onChange={set("b2cConsumerKey")} saved={account?.saved?.b2cConsumerKey} unreadable={account?.unreadable?.includes("b2cConsumerKey")} />
                <Secret id="pay-b2c-cs" title="B2C consumer secret" value={form.b2cConsumerSecret} onChange={set("b2cConsumerSecret")} saved={account?.saved?.b2cConsumerSecret} unreadable={account?.unreadable?.includes("b2cConsumerSecret")} />
                <Text id="pay-b2c-init" title="B2C initiator name" value={form.b2cInitiatorName} onChange={set("b2cInitiatorName")} />
                <Secret id="pay-b2c-cred" title="B2C security credential" value={form.b2cSecurityCredential} onChange={set("b2cSecurityCredential")} saved={account?.saved?.b2cSecurityCredential} unreadable={account?.unreadable?.includes("b2cSecurityCredential")} />
              </div>
            </>
          )}
        </section>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="submit" className="stg-btn-primary" disabled={saving || !form.shortcode.trim() || !data.canSaveSecrets}>{saving ? "Saving…" : "Save"}</button>
          {account && (
            <button type="button" className="stg-btn-secondary" disabled={removing}
              onClick={() => { if (window.confirm("Stop using your own Paybill and forget its keys? Payments already recorded stay. New invoices go back to this server's Paybill.")) remove(); }}>
              {removing ? "Removing…" : "Remove"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
