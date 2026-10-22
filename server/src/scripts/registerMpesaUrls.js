// Tells Safaricom where to send payments made straight to the installation's Paybill (C2B), then
// exits.
//   npm run mpesa:register-urls
//
// (A workspace's own Paybill, saved in Settings → Payments, is registered from that screen.)
// Run once per Paybill, after MPESA_* are set in .env and the API is reachable over HTTPS at
// MPESA_CALLBACK_BASE_URL (default API_PUBLIC_URL). The production app must have the C2B product.
// In production Safaricom keeps the first URLs registered for a Paybill — to change them later,
// they have to be asked to delete the old ones (apisupport@safaricom.co.ke). So check the URLs
// printed below before confirming with --yes.
require("dotenv").config({ quiet: true });

const { config, isConfigured, callbackUrl } = require("../modules/payments/mpesa/mpesa.config");
const MpesaClient = require("../modules/payments/mpesa/mpesa.client");

async function main() {
  if (!isConfigured()) {
    console.error("M-Pesa isn't configured: set MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_PASSKEY, MPESA_CALLBACK_TOKEN (24+ characters) and an https API_PUBLIC_URL or MPESA_CALLBACK_BASE_URL.");
    process.exitCode = 1;
    return;
  }
  // The token is secret — show only its first few characters.
  const shown = (url) => url.replace(config.callbackToken, `${config.callbackToken.slice(0, 4)}…`);
  console.log(`Paybill ${config.shortcode} (${config.environment})`);
  console.log(`  Confirmation URL: ${shown(callbackUrl("confirm", config))}`);
  console.log(`  Validation URL:   ${shown(callbackUrl("validate", config))}`);
  if (!process.argv.includes("--yes")) {
    console.log("\nNothing sent. Check the URLs above, then run again with --yes:  npm run mpesa:register-urls -- --yes");
    return;
  }
  const result = await MpesaClient.registerC2bUrls(config);
  console.log("Safaricom answered:", JSON.stringify(result));
}

main().catch((err) => {
  console.error("Registering the URLs failed:", err.message, err.body ? JSON.stringify(err.body) : "");
  process.exitCode = 1;
});
