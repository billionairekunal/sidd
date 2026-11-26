// Vehicle papers and their renewal rules — shared by the Fleet page, the dashboard and the API.
// `months` = the usual renewal period; the Renew dialog suggests it, the user can change the date.
export const PAPERS = [
  { key: "insurance_upto", label: "Insurance", short: "Insurance", months: 12 },
  { key: "pucc_upto", label: "PUC (Pollution)", short: "PUC", months: 12 },
  { key: "fitness_upto", label: "Fitness", short: "Fitness", months: 24 },
  { key: "tax_upto", label: "Road Tax", short: "Tax", months: 12 },
  { key: "permit_upto", label: "Permit", short: "Permit", months: 60 },
  { key: "national_permit_upto", label: "National Permit", short: "Nat. Permit", months: 12 },
];
export const PAPER_KEYS = PAPERS.map((p) => p.key);
export const paperByKey = Object.fromEntries(PAPERS.map((p) => [p.key, p]));

export const CATEGORIES = [
  { key: "line", label: "Line (Long Route)" },
  { key: "local", label: "Local" },
];

export const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));

// Today as YYYY-MM-DD in India time (the business runs on IST, whatever the PC clock zone).
export const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

// Whole days from `today` to `date` (negative = already expired). null when no date.
export const daysLeft = (date, today = todayIST()) =>
  isDate(date) ? Math.round((Date.parse(date) - Date.parse(today)) / 86400000) : null;

// Alert buckets, most urgent first. Rows within RED_DAYS (incl. expired) are painted red.
export const RED_DAYS = 3;
export const BUCKETS = [
  { key: "expired", label: "Expired", hint: "Renew now", max: -1 },
  { key: "urgent", label: "Urgent", hint: "Within 5 days", max: 5 },
  { key: "d15", label: "Within 15 days", hint: "6 – 15 days", max: 15 },
  { key: "d30", label: "Within 1 month", hint: "16 – 30 days", max: 30 },
  { key: "ok", label: "Valid", hint: "More than 30 days", max: Infinity },
];
export const bucketOf = (days) => (days == null ? "none" : BUCKETS.find((b) => days <= b.max).key);

export function addMonths(date, months) {
  const [y, m, d] = date.split("-").map(Number);
  const last = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + months, Math.min(d, last))).toISOString().slice(0, 10);
}

// One row per (vehicle, paper) that has a date, most urgent first.
export function paperRows(vehicles, today = todayIST()) {
  return vehicles
    .flatMap((v) =>
      PAPERS.filter((p) => isDate(v[p.key])).map((p) => {
        const days = daysLeft(v[p.key], today);
        return { id: `${v.id}-${p.key}`, vehicle: v, paper: p, date: v[p.key], days, bucket: bucketOf(days) };
      })
    )
    .sort((a, b) => a.days - b.days || a.vehicle.vehicle_no.localeCompare(b.vehicle.vehicle_no));
}

export const fmtDate = (d) =>
  isDate(d) ? new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export const daysText = (days) =>
  days == null ? "No date" : days < 0 ? `Expired ${-days} day${days === -1 ? "" : "s"} ago` : days === 0 ? "Expires today" : `${days} day${days === 1 ? "" : "s"} left`;

// Self-check: node src/lib/papers.js
if (typeof process !== "undefined" && process.argv?.[1]?.endsWith("papers.js")) {
  const assert = (c, m) => { if (!c) throw new Error(m); };
  assert(daysLeft("2026-11-29", "2026-11-26") === 3, "daysLeft");
  assert(daysLeft("2026-11-20", "2026-11-26") === -6, "daysLeft past");
  assert(bucketOf(-1) === "expired" && bucketOf(0) === "urgent" && bucketOf(5) === "urgent", "bucket 0-5");
  assert(bucketOf(6) === "d15" && bucketOf(15) === "d15" && bucketOf(16) === "d30" && bucketOf(31) === "ok", "buckets");
  assert(addMonths("2026-01-31", 1) === "2026-02-28" && addMonths("2026-08-30", 12) === "2027-08-30", "addMonths");
  console.log("papers.js ok");
}
