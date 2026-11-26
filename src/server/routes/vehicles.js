import { db, withTransaction } from "../db.js";
import { requireRole, route } from "../auth.js";
import { PAPER_KEYS, isDate } from "../../lib/papers.js";

const STATUSES = ["Available", "Loading", "In Transit", "Maintenance", "Idle"];
const CATEGORIES = ["line", "local"];
const canManage = requireRole(["owner", "dispatcher"]);

// Columns the client may set (body keys are the column names).
const TEXT_COLS = ["vehicle_no", "category", "vehicle_type", "fuel_type", "owner_name", "driver_name", "driver_phone",
  "affiliated_company", "status", "registration_date", "engine_no", "chassis_no", ...PAPER_KEYS];
const DATE_COLS = ["registration_date", ...PAPER_KEYS];

// Picks known columns from the body, trims text, "" → null. Returns [fields, error].
function clean(body = {}) {
  const fields = {};
  for (const col of [...TEXT_COLS, "capacity_kg"]) {
    if (!(col in body)) continue;
    let v = body[col];
    if (typeof v === "string") v = v.trim();
    if (v === "" || v === undefined) v = null;
    if (col === "vehicle_no" && v) v = v.toUpperCase();
    if (col === "capacity_kg" && v != null) v = Number(v) || null;
    fields[col] = v;
  }
  for (const col of DATE_COLS) {
    if (fields[col] && !isDate(fields[col])) return [null, `${col} must be a date (YYYY-MM-DD)`];
  }
  if ("vehicle_no" in fields && !fields.vehicle_no) return [null, "Vehicle number is required"];
  if (fields.status && !STATUSES.includes(fields.status)) return [null, `status must be one of ${STATUSES.join(", ")}`];
  if ("category" in fields && !CATEGORIES.includes(fields.category)) return [null, "category must be line or local"];
  return [fields, null];
}

const byId = (id) => db.prepare("SELECT * FROM vehicles WHERE id = ?").get(id);
const duplicate = (err) => err?.code === "23505";

export const list = route(async (req, res) => {
  res.json(await db.prepare("SELECT * FROM vehicles ORDER BY vehicle_no").all());
});

export const create = route(canManage, async (req, res) => {
  const [fields, error] = clean({ category: "line", status: "Available", ...req.body });
  if (error) return res.status(400).json({ error });
  if (!fields.vehicle_no) return res.status(400).json({ error: "Vehicle number is required" });
  const cols = Object.keys(fields);
  try {
    const result = await db
      .prepare(`INSERT INTO vehicles (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`)
      .run(...cols.map((c) => fields[c]));
    res.status(201).json(await byId(result.lastInsertRowid));
  } catch (err) {
    if (duplicate(err)) return res.status(409).json({ error: "Vehicle number already exists" });
    throw err;
  }
});

export const update = route(canManage, async (req, res) => {
  const { id } = req.params;
  if (!(await byId(id))) return res.status(404).json({ error: "Vehicle not found" });
  const [fields, error] = clean(req.body);
  if (error) return res.status(400).json({ error });
  const cols = Object.keys(fields);
  if (cols.length) {
    try {
      await db
        .prepare(`UPDATE vehicles SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`)
        .run(...cols.map((c) => fields[c]), id);
    } catch (err) {
      if (duplicate(err)) return res.status(409).json({ error: "Vehicle number already exists" });
      throw err;
    }
  }
  res.json(await byId(id));
});

export const remove = route(canManage, async (req, res) => {
  const used = await db.prepare("SELECT 1 FROM lrs WHERE vehicle_id = ? LIMIT 1").get(req.params.id);
  if (used) return res.status(409).json({ error: "This vehicle is on lorry receipts, so it can't be removed. Set its status to Idle instead." });
  await db.prepare("DELETE FROM vehicles WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

// Renewal history of one vehicle, newest first.
export const renewals = route(async (req, res) => {
  const rows = await db
    .prepare(
      `SELECT r.*, u.name AS renewed_by_name FROM vehicle_renewals r
       LEFT JOIN users u ON u.id = r.renewed_by
       WHERE r.vehicle_id = ? ORDER BY r.id DESC`
    )
    .all(req.params.id);
  res.json(rows);
});

// Renew one paper: log old → new expiry, then move the vehicle's date forward.
export const renew = route(canManage, async (req, res) => {
  const { id } = req.params;
  const { paper, newUpto, amount, refNo, note } = req.body || {};
  if (!PAPER_KEYS.includes(paper)) return res.status(400).json({ error: "Unknown paper" });
  if (!isDate(newUpto)) return res.status(400).json({ error: "New expiry date is required" });
  const vehicle = await byId(id);
  if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });

  await withTransaction(async () => {
    await db
      .prepare(
        "INSERT INTO vehicle_renewals (vehicle_id, paper, old_upto, new_upto, amount, ref_no, note, renewed_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(id, paper, vehicle[paper], newUpto, Number(amount) || null, refNo?.trim() || null, note?.trim() || null, req.user.id);
    // `paper` is checked against PAPER_KEYS above, so it is safe as a column name.
    await db.prepare(`UPDATE vehicles SET ${paper} = ? WHERE id = ?`).run(newUpto, id);
  });
  res.status(201).json(await byId(id));
});
