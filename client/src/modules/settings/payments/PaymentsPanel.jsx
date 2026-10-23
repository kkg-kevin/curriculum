import { useEffect, useState } from "react";
import {
  usePaymentSettings, useSavePaymentSettings, useRemovePaymentSettings, useRegisterPaybillUrls, useTestPaymentKeys,
} from "./paymentSettingsApi";
import { SettingsSection, Field, FieldGrid, SubHeading, StatusDot, LoadState } from "../components/SettingsLayout";

const hint = { margin: 0, fontSize: 12, color: "#6B7280", lineHeight: 1.5 };

const EMPTY = {
  enabled: true, environment: "sandbox", shortcode: "", accountLabel: "", initiatorName: "", b2cShortcode: "", b2cInitiatorName: "",
  consumerKey: "", consumerSecret: "", passkey: "", securityCredential: "", b2cConsumerKey: "", b2cConsumerSecret: "", b2cSecurityCredential: "",
};
const SECRETS = ["consumerKey", "consumerSecret", "passkey", "securityCredential", "b2cConsumerKey", "b2cConsumerSecret", "b2cSecurityCredential"];

function Text({ id, title, value, onChange, placeholder, maxLength = 100, help }) {
  return (
    <Field label={title} htmlFor={id} note={help}>
      <input id={id} className="stg-input" value={value} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" />
    </Field>
  );
}

// A write-only field: shows whether something is saved, never what.
function Secret({ id, title, value, onChange, saved, unreadable }) {
  return (
    <Field label={title} htmlFor={id} warning={unreadable ? "Saved, but this server can no longer read it (its MPESA_SECRETS_KEY changed). Enter it again." : null}>
      <input id={id} className="stg-input" type="password" value={value} onChange={(e) => onChange(e.target.value)} autoComplete="new-password" placeholder={saved ? "Saved — type to replace" : "Not set"} />
    </Field>
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

  if (isLoading || isError || !data) return <LoadState isLoading={isLoading} isError={isError || (!isLoading && !data)} what="Payment settings" />;

  const secret = (key, title) => (
    <Secret id={`pay-${key}`} title={title} value={form[key]} onChange={set(key)} saved={account?.saved?.[key]} unreadable={account?.unreadable?.includes(key)} />
  );

  return (
    <SettingsSection
      as="form"
      onSubmit={submit}
      title="M-Pesa connection (Daraja)"
      description={<>Connects your Paybill so phone prompts work and Paybill payments are matched to invoices automatically. Without one, {data.installation.enabled ? <>this server&apos;s Paybill (<strong>{data.installation.paybill}</strong>) is used.</> : "M-Pesa payments are confirmed by hand."}</>}
      aside={account ? (
        <>
          <StatusDot ok={account.enabled && account.ready.prompts}>{account.enabled ? (account.ready.prompts ? "Taking payments" : "Keys missing") : "Not in use"}</StatusDot>
          <StatusDot ok={Boolean(account.c2bRegisteredAt)}>{account.c2bRegisteredAt ? "URLs registered" : "URLs not registered"}</StatusDot>
        </>
      ) : <StatusDot ok={false}>Not connected</StatusDot>}
      footer={(
        <>
          <button type="submit" className="stg-btn-primary" disabled={saving || !form.shortcode.trim() || !data.canSaveSecrets}>{saving ? "Saving…" : "Save"}</button>
          {account && (
            <>
              <button type="button" className="stg-btn-secondary" disabled={test.isPending} onClick={() => test.mutate()}>{test.isPending ? "Testing…" : "Test the keys"}</button>
              <button type="button" className="stg-btn-secondary" disabled={registering || !account.ready.prompts} onClick={registerUrls}>{registering ? "Registering…" : account.c2bRegisteredAt ? "Register URLs again" : "Register Paybill URLs"}</button>
              <button type="button" className="stg-btn-secondary" disabled={removing} style={{ marginLeft: "auto", color: "#B91C1C" }}
                onClick={() => { if (window.confirm("Stop using your own Paybill and forget its keys? Payments already recorded stay. New invoices go back to this server's Paybill.")) remove(); }}>
                {removing ? "Removing…" : "Remove"}
              </button>
            </>
          )}
        </>
      )}
    >
      {!data.canSaveSecrets && <p style={{ ...hint, color: "#B45309" }}>This server can&apos;t store M-Pesa keys yet: MPESA_SECRETS_KEY must be set on it first.</p>}
      {!data.callbackBaseOk && <p style={{ ...hint, color: "#B45309" }}>Safaricom can&apos;t reach this server yet: API_PUBLIC_URL (or MPESA_CALLBACK_BASE_URL) must be a public https address.</p>}
      {test.data?.results?.map((r) => (
        <p key={r.label} style={{ ...hint, color: r.ok ? "#047857" : "#B91C1C" }}>{r.label}: {r.message}</p>
      ))}

      <SubHeading>Paybill</SubHeading>
      <FieldGrid min={180}>
        <Text id="pay-shortcode" title="Paybill number" value={form.shortcode} onChange={set("shortcode")} placeholder="e.g. 123456" maxLength={10} />
        <Field label="Mode" htmlFor="pay-env">
          <select id="pay-env" className="stg-input" value={form.environment} onChange={(e) => set("environment")(e.target.value)}>
            <option value="sandbox">Test (sandbox)</option>
            <option value="production">Live (production)</option>
          </select>
        </Field>
        <Text id="pay-label" title="Name payers see" value={form.accountLabel} onChange={set("accountLabel")} placeholder="e.g. Digifunzi" />
      </FieldGrid>
      <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600, color: "#374151" }}>
        <input type="checkbox" checked={form.enabled} onChange={(e) => set("enabled")(e.target.checked)} />
        Use this Paybill for this workspace&apos;s invoices
      </label>

      <SubHeading note="From your Daraja app on developer.safaricom.co.ke. For live, use the passkey Safaricom emails after Go Live.">API keys</SubHeading>
      <FieldGrid min={180}>
        {secret("consumerKey", "Consumer key")}
        {secret("consumerSecret", "Consumer secret")}
        {secret("passkey", "Passkey (M-Pesa Express)")}
      </FieldGrid>

      <button type="button" onClick={() => setShowAdvanced((v) => !v)} style={{ alignSelf: "flex-start", border: 0, background: "transparent", color: "#25476a", fontWeight: 700, fontSize: 12.5, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
        {showAdvanced ? "Hide" : "Show"} checks, reversals and paying educators
      </button>
      {showAdvanced && (
        <>
          <SubHeading note="The Paybill's API operator, from the M-Pesa business portal. Lets staff check payments and send back money that's on no invoice.">Checks and reversals</SubHeading>
          <FieldGrid min={180}>
            <Text id="pay-init" title="Initiator name" value={form.initiatorName} onChange={set("initiatorName")} />
            {secret("securityCredential", "Security credential")}
          </FieldGrid>
          <SubHeading note="A disbursement shortcode for paying approved claims. Anything left empty uses the Paybill's values.">Paying educators (B2C)</SubHeading>
          <FieldGrid min={180}>
            <Text id="pay-b2c" title="B2C shortcode" value={form.b2cShortcode} onChange={set("b2cShortcode")} maxLength={10} />
            {secret("b2cConsumerKey", "B2C consumer key")}
            {secret("b2cConsumerSecret", "B2C consumer secret")}
            <Text id="pay-b2c-init" title="B2C initiator name" value={form.b2cInitiatorName} onChange={set("b2cInitiatorName")} />
            {secret("b2cSecurityCredential", "B2C security credential")}
          </FieldGrid>
        </>
      )}

      {account && (
        <p style={hint}>
          {account.ready.checks ? "Checks and reversals ready" : "Checks and reversals not set up"} · {account.ready.payouts ? "educator payouts ready" : "educator payouts not set up"}. Confirmation URL: <code>{account.urls.confirmation}</code>
        </p>
      )}
    </SettingsSection>
  );
}
