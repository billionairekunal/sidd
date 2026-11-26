import { requireRole, route } from "../auth.js";

// Reads a photo of a (often handwritten) lorry receipt / bilty / challan with
// Gemini and returns the LR form fields. Nothing is saved here: the person
// reviews and edits the filled form before creating the LR.

const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // client resizes first; this is a safety cap
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const FREIGHT_TERMS = ["Paid", "To Pay", "To Be Billed"];

// Tried in order. GEMINI_MODEL (in .env.local) goes first if set.
const MODELS = [
  ...new Set(
    [process.env.GEMINI_MODEL, "gemini-flash-lite-latest", "gemini-3.5-flash-lite", "gemini-flash-latest"].filter(Boolean)
  ),
];

const PROMPT = `You are reading a photo of an Indian transport document — usually a handwritten
lorry receipt (LR / bilty / consignment note), sometimes a delivery challan or tax invoice.
It may mix English, Hindi and Marathi. Extract the fields below.

Rules:
- Only report what is actually written. If a field is missing, unreadable or you are unsure,
  return "" for it. Never guess or invent values.
- Write names and places in English letters (transliterate Hindi/Marathi words).
- lrDate: the document date as YYYY-MM-DD ("" if not clear). Indian dates are day/month/year.
- consignor = sender / from party; consignee = receiver / to party.
- fromLocation / toLocation: the city or place names of the route.
- vehicleNo: truck number like MH-12-AB-1234, uppercase.
- freightTerms: exactly one of "Paid", "To Pay", "To Be Billed", or "".
- items: one entry per goods line. Numbers as plain digits without units or commas.
- legible: false only if the photo is too blurry/dark/cropped to read the main fields.
- unclearFields: names of fields you saw but could not read with confidence.`;

const S = { type: "STRING" };
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    legible: { type: "BOOLEAN" },
    lrDate: S,
    consignorName: S,
    consignorAddress: S,
    consigneeName: S,
    consigneeAddress: S,
    fromLocation: S,
    toLocation: S,
    vehicleNo: S,
    invoiceNo: S,
    ewayBillNo: S,
    deliveryAt: S,
    freightTerms: S,
    remarks: S,
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          noOfPkgs: S,
          saidToContain: S,
          weightKg: S,
          ratePerKg: S,
          freightAmount: S,
          remarks: S,
        },
      },
    },
    unclearFields: { type: "ARRAY", items: S },
  },
  required: ["legible"],
};

const str = (v) => (typeof v === "string" ? v.trim() : "");
const num = (v) => str(v).replace(/[^\d.]/g, ""); // "1,200 kg" -> "1200"

function clean(raw) {
  const date = str(raw.lrDate);
  const terms = FREIGHT_TERMS.find((t) => t.toLowerCase() === str(raw.freightTerms).toLowerCase()) || "";
  const items = (Array.isArray(raw.items) ? raw.items : [])
    .map((i) => ({
      noOfPkgs: num(i.noOfPkgs),
      saidToContain: str(i.saidToContain),
      weightKg: num(i.weightKg),
      ratePerKg: num(i.ratePerKg),
      freightAmount: num(i.freightAmount),
      remarks: str(i.remarks),
    }))
    .filter((i) => Object.values(i).some(Boolean));
  return {
    legible: raw.legible !== false,
    fields: {
      lrDate: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "",
      consignorName: str(raw.consignorName),
      consignorAddress: str(raw.consignorAddress),
      consigneeName: str(raw.consigneeName),
      consigneeAddress: str(raw.consigneeAddress),
      fromLocation: str(raw.fromLocation),
      toLocation: str(raw.toLocation),
      vehicleNo: str(raw.vehicleNo).toUpperCase(),
      invoiceNo: str(raw.invoiceNo),
      ewayBillNo: str(raw.ewayBillNo).replace(/\s/g, ""),
      deliveryAt: str(raw.deliveryAt),
      freightTerms: terms,
      remarks: str(raw.remarks),
    },
    items,
    unclearFields: Array.isArray(raw.unclearFields) ? raw.unclearFields.map(str).filter(Boolean) : [],
  };
}

export const scan = route(requireRole(["owner", "dispatcher", "creator"]), async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "Photo scanning isn't set up yet (GEMINI_API_KEY is missing)." });
  }

  const { image, mimeType } = req.body || {};
  if (typeof image !== "string" || !image || !ALLOWED_TYPES.includes(mimeType)) {
    return res.status(400).json({ error: "Please upload a JPG, PNG or WebP photo." });
  }
  if (image.length * 0.75 > MAX_IMAGE_BYTES) {
    return res.status(413).json({ error: "Photo is too large. Please try a smaller photo." });
  }

  const body = JSON.stringify({
    contents: [{ parts: [{ inline_data: { mime_type: mimeType, data: image } }, { text: PROMPT }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA, temperature: 0 },
  });

  // Free models are sometimes busy (503) and have per-model daily limits (429),
  // so try the next model in the list before giving up.
  let response;
  for (const model of MODELS) {
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-goog-api-key": apiKey },
        body,
        signal: AbortSignal.timeout(25_000),
      });
    } catch {
      response = null; // network error or timeout: try the next model
      continue;
    }
    if (![404, 429, 500, 503].includes(response.status)) break; // 404 = model retired
  }

  if (!response) {
    return res.status(504).json({ error: "Couldn't reach the scanning service. Check the internet and try again." });
  }

  if (!response.ok) {
    const status = response.status;
    const message =
      status === 429
        ? "Today's free scanning limit is used up. Please fill the form by hand or try again later."
        : status === 503 || status === 500
          ? "The scanning service is busy right now. Please try again in a minute."
        : status === 401 || status === 403
          ? "The scanning key was rejected. Please check GEMINI_API_KEY."
          : "The scanning service couldn't read this photo. Please try again.";
    return res.status(status === 429 ? 429 : 502).json({ error: message });
  }

  const data = await response.json().catch(() => null);
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return res.status(502).json({ error: "Couldn't understand this photo. Please retake it with the whole LR visible." });
  }

  res.json(clean(raw));
});
