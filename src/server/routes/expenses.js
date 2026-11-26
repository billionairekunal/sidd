import { db } from "../db.js";
import { route } from "../auth.js";
import { isDate, todayIST } from "../../lib/papers.js";
import { CATEGORY_KEYS } from "../../lib/expenses.js";

const office = { roles: ["owner", "dispatcher"] };

const ROW_SQL = `SELECT e.*, v.vehicle_no FROM expenses e LEFT JOIN vehicles v ON v.id = e.vehicle_id`;

// Validates the body. Returns [values, error].
function clean(b = {}) {
  const s = (v) => (typeof v === "string" ? v.trim() : "");
  const out = {
    exp_date: s(b.exp_date),
    paid_by: s(b.paid_by),
    paid_to: s(b.paid_to),
    reason: s(b.reason) || null,
    amount: Number(b.amount),
    category: CATEGORY_KEYS.includes(b.category) ? b.category : "Other",
    vehicle_id: Number(b.vehicle_id) || null,
  };
  if (!isDate(out.exp_date)) return [null, "Date is required"];
  if (!out.paid_by) return [null, "Paid by is required"];
  if (!out.paid_to) return [null, "Paid to is required"];
  if (!(out.amount > 0)) return [null, "Amount must be more than 0"];
  return [out, null];
}

const monthRange = (m) => {
  const [y, mo] = m.split("-").map(Number);
  return [`${m}-01`, new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10)];
};

// GET /api/expenses?from=&to=[&prev_from=&prev_to=] (or ?month=YYYY-MM)
// → rows in the range, the previous period's total, month totals and name suggestions.
export const list = route(office, async (req, res) => {
  let { from, to, prev_from, prev_to, month } = req.query;
  if (!isDate(from) || !isDate(to)) {
    [from, to] = monthRange(/^\d{4}-\d{2}$/.test(month || "") ? month : todayIST().slice(0, 7));
  }
  const hasPrev = isDate(prev_from) && isDate(prev_to);
  const [rows, prev, months, payers, payees] = await Promise.all([
    db.prepare(`${ROW_SQL} WHERE e.exp_date BETWEEN ? AND ? ORDER BY e.exp_date DESC, e.id DESC`).all(from, to),
    hasPrev
      ? db.prepare("SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM expenses WHERE exp_date BETWEEN ? AND ?").get(prev_from, prev_to)
      : null,
    db.prepare("SELECT substr(exp_date, 1, 7) AS month, SUM(amount) AS total, COUNT(*) AS count FROM expenses GROUP BY 1 ORDER BY 1").all(),
    db.prepare("SELECT paid_by AS name FROM expenses GROUP BY paid_by ORDER BY COUNT(*) DESC").all(),
    // Each payee with what they were last paid for, so a known name fills category + vehicle.
    db.prepare(
      `SELECT p.name, p.n, l.category, l.vehicle_id FROM
         (SELECT paid_to AS name, COUNT(*) AS n, MAX(id) AS last_id FROM expenses GROUP BY paid_to ORDER BY n DESC LIMIT 400) p
       JOIN expenses l ON l.id = p.last_id ORDER BY p.n DESC`
    ).all(),
  ]);
  res.json({ from, to, rows, prev, months, payers: payers.map((p) => p.name), payees });
});

// POST /api/expenses/bulk { ids: [..], category } → set one category on many rows.
export const bulk = route(office, async (req, res) => {
  const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).map(Number).filter(Number.isInteger).slice(0, 2000);
  const { category } = req.body || {};
  if (!ids.length) return res.status(400).json({ error: "Pick some expenses first" });
  if (!CATEGORY_KEYS.includes(category)) return res.status(400).json({ error: "Unknown category" });
  const r = await db.prepare(`UPDATE expenses SET category = ? WHERE id IN (${ids.map(() => "?").join(",")})`).run(category, ...ids);
  res.json({ updated: r.changes });
});

export const create = route(office, async (req, res) => {
  const [v, error] = clean(req.body);
  if (error) return res.status(400).json({ error });
  const r = await db
    .prepare("INSERT INTO expenses (exp_date, paid_by, paid_to, reason, amount, category, vehicle_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(v.exp_date, v.paid_by, v.paid_to, v.reason, v.amount, v.category, v.vehicle_id, req.user.id);
  res.status(201).json(await db.prepare(`${ROW_SQL} WHERE e.id = ?`).get(r.lastInsertRowid));
});

export const update = route(office, async (req, res) => {
  const [v, error] = clean(req.body);
  if (error) return res.status(400).json({ error });
  const r = await db
    .prepare("UPDATE expenses SET exp_date = ?, paid_by = ?, paid_to = ?, reason = ?, amount = ?, category = ?, vehicle_id = ? WHERE id = ?")
    .run(v.exp_date, v.paid_by, v.paid_to, v.reason, v.amount, v.category, v.vehicle_id, req.params.id);
  if (!r.changes) return res.status(404).json({ error: "Expense not found" });
  res.json(await db.prepare(`${ROW_SQL} WHERE e.id = ?`).get(req.params.id));
});

export const remove = route(office, async (req, res) => {
  await db.prepare("DELETE FROM expenses WHERE id = ?").run(req.params.id);
  res.status(204).end();
});
