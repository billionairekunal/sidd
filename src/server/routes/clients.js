import { db } from "../db.js";
import { requireRole, route } from "../auth.js";

const canManage = requireRole(["owner", "dispatcher"]);

export const list = route(async (req, res) => {
  res.json(await db.prepare("SELECT * FROM clients ORDER BY name").all());
});

export const create = route(canManage, async (req, res) => {
  const { name, gstin, address, paymentTermsDays, gateContactName, gateContactPhone } = req.body || {};
  if (!name) return res.status(400).json({ error: "name is required" });
  try {
    const result = await db
      .prepare(
        "INSERT INTO clients (name, gstin, address, payment_terms_days, gate_contact_name, gate_contact_phone) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run(name.trim(), gstin || null, address || null, paymentTermsDays || 21, gateContactName || null, gateContactPhone || null);
    res.status(201).json(await db.prepare("SELECT * FROM clients WHERE id = ?").get(result.lastInsertRowid));
  } catch {
    res.status(409).json({ error: "Client already exists" });
  }
});

export const update = route(canManage, async (req, res) => {
  const { id } = req.params;
  const existing = await db.prepare("SELECT * FROM clients WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Client not found" });

  const { gstin, address, paymentTermsDays, gateContactName, gateContactPhone } = req.body || {};
  await db.prepare(
    `UPDATE clients SET
      gstin = COALESCE(?, gstin),
      address = COALESCE(?, address),
      payment_terms_days = COALESCE(?, payment_terms_days),
      gate_contact_name = COALESCE(?, gate_contact_name),
      gate_contact_phone = COALESCE(?, gate_contact_phone)
     WHERE id = ?`
  ).run(gstin ?? null, address ?? null, paymentTermsDays ?? null, gateContactName ?? null, gateContactPhone ?? null, id);

  res.json(await db.prepare("SELECT * FROM clients WHERE id = ?").get(id));
});

export const remove = route(canManage, async (req, res) => {
  await db.prepare("DELETE FROM clients WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

