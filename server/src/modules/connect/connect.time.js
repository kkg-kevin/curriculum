// Today's date in Kenya ("YYYY-MM-DD", UTC+3, no daylight saving) — challenge dates are Kenyan dates.
const kenyaToday = (at = new Date()) => new Date(at.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

module.exports = { kenyaToday };
