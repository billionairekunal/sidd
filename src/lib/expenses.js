// Expense categories and the keyword rules that guess one from "paid to" + "reason".
// First match wins, so the order matters (e.g. "vinsum mathadi" → Mathadi, "fastag recharge" → FASTag).
// Words come from the real expense sheet (English, short forms and Marathi).
export const CATEGORIES = [
  { key: "RTO & Papers", words: ["rto", "insurance", "permit", "puc", "fitness", "passing", "road tax", "transport commi"] },
  { key: "FASTag & Toll", words: ["fastag", "toll"] },
  { key: "Maintenance & Repairs", words: ["maint", "repair", "tyre", "tire", "grees", "grease", "washing", "puncture", "battery", "service", "automobile", "auto pvt", "auto parts", "parts", "spare", "gabriel", "oil change", "fait", "welding", "engine", "fabrication", "camera", "garage", "mechanic", "clutch", "brake", "denting", "cng work"] },
  { key: "Diesel & Fuel", words: ["diesel", "disel", "deisel", "डिझेल", "petrol", "bpcl", "bharat petroleum", "hpcl", "indian oil", "fuel", "dattaguru", "add blue", "adblue", "add blu"] },
  { key: "Mathadi & Loading", words: ["mathadi", "mathdi", "mathad", "माथाडी", "vinsum", "unloading", "loading", "hamali", "forklift", "operator", "oprator"] },
  { key: "Personal & Owner", words: ["self", "bhishi", "sweets", "mango", "uria", "urea", "construct", "consruction"] },
  { key: "Trip Payment", words: ["bix", "blx", "bslx", "pod", "trip", "bhada", "bhade", "freight", "logistics", "transport", "payment"] },
  { key: "Driver Payment", words: ["advance", "adv", "आडवांस", "ऍडव्हान्स", "अॅडव्हान्स", "driver"] },
  { key: "Salary", words: ["salary", "pagar", "wages", "cleaner"] },
  { key: "GPS & Office", words: ["office", "curior", "courier", "stationery", "light bill", "electricity", "rent", "recharge", "gps", "vltd", "wheelseye", "tea"] },
  { key: "Other", words: [] },
];
export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);

const hasWord = (text, w) => new RegExp(`(^|[^a-z])${w.replace(/ /g, "\\s*")}`).test(text);

export function guessCategory(paidTo = "", reason = "") {
  const text = `${paidTo} ${reason}`.toLowerCase();
  const hit = CATEGORIES.find((c) => c.words.some((w) => hasWord(text, w)))?.key;
  if (hit) return hit;
  // "vishal 1238", "5189 kedar": a person named with a truck number is that truck's driver.
  return /(^|\D)\d{3,4}(\D|$)/.test(paidTo) ? "Driver Payment" : "Other";
}

// "1238", "kq 851", "0851" in the text → the one vehicle whose number ends with those 4 digits.
// No guess when two trucks share the digits (e.g. EM-0752 and KQ-0752).
export function guessVehicle(text = "", vehicles = []) {
  for (const m of text.matchAll(/(?<!\d)(\d{3,4})(?!\d)/g)) {
    const digits = m[1].padStart(4, "0");
    const hits = vehicles.filter((v) => v.vehicle_no.replace(/\D/g, "").endsWith(digits));
    if (hits.length === 1) return hits[0];
  }
  return null;
}

export const rupees = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

// Self-check: node src/lib/expenses.js
if (typeof process !== "undefined" && process.argv?.[1]?.endsWith("expenses.js")) {
  const assert = (c, m) => { if (!c) throw new Error(m); };
  assert(guessCategory("MS Vinsum Axpress", "vinsum mathadi") === "Mathadi & Loading", "mathadi");
  assert(guessCategory("IDFC First Bank", "5189 fastag recharge") === "FASTag & Toll", "fastag");
  assert(guessCategory("Bharat Petroleum", "") === "Diesel & Fuel", "fuel");
  assert(guessCategory("Swapnil", "Advance") === "Driver Payment", "advance");
  assert(guessCategory("vishal 1238", "") === "Driver Payment", "driver by truck no");
  assert(guessCategory("Gaikwad", "1238/2102/6311 bix") === "Trip Payment", "bix trip");
  assert(guessCategory("Pintu Ghuge", "नाशिक माथाडी") === "Mathadi & Loading", "marathi mathadi");
  assert(guessCategory("Jaishwal Ganesh", "0851 engine work") === "Maintenance & Repairs", "engine");
  assert(guessCategory("Wheelseye Technologies", "wheelseye recharge") === "GPS & Office", "gps");
  assert(guessCategory("Sunil Khose", "9596/0752 Rto") === "RTO & Papers", "rto");
  assert(guessCategory("Raju shet", "") === "Other", "other");
  assert(guessCategory("Rahi", "cnh") === "Other", "no false match");
  const vs = [{ vehicle_no: "MH-14-KQ-0851" }, { vehicle_no: "MH-14-EM-0752" }, { vehicle_no: "MH-14-KQ-0752" }, { vehicle_no: "MH-14-LX-1238" }];
  assert(guessVehicle("kq 851 diesel", vs)?.vehicle_no === "MH-14-KQ-0851", "851");
  assert(guessVehicle("vishal 1238", vs)?.vehicle_no === "MH-14-LX-1238", "1238");
  assert(guessVehicle("0752 rto", vs) === null, "ambiguous");
  assert(guessVehicle("paid 50000", vs) === null, "5 digits ignored");
  console.log("expenses.js ok");
}
