import { db, withTransaction, NOW, TODAY_IST, istDate } from "../db.js";
import { requireRole, route } from "../auth.js";

const STATUSES = ["Draft", "In Transit", "Delivered", "Paid", "Disputed", "Cancelled"];

// Every legal state transition is listed explicitly with exactly who may
// perform it. Anything not listed here is not a legal transition at all,
// regardless of role — this is the authoritative check; the frontend's
// per-role button visibility is just a convenience on top of this.
const TRANSITIONS = {
  "Draft->In Transit": ["owner", "dispatcher"],
  "Draft->Cancelled": ["owner", "dispatcher"],
  "In Transit->Delivered": ["receiver"],
  "In Transit->Disputed": ["receiver"],
  "Delivered->Paid": ["receiver"],
  "Delivered->Disputed": ["owner", "dispatcher"],
  "Disputed->In Transit": ["owner", "dispatcher"],
  "Disputed->Delivered": ["owner", "dispatcher"],
  "Disputed->Cancelled": ["owner", "dispatcher"],
};

const VEHICLE_STATUS_BY_LR_STATUS = {
  "In Transit": "In Transit",
  Delivered: "Available",
  Paid: "Available",
  Disputed: "Available",
  Cancelled: "Available",
};

const count = async (text, ...params) => (await db.prepare(text).get(...params)).c;
const getLr = (id) => db.prepare("SELECT * FROM lrs WHERE id = ?").get(id);

// Attach items, status log and vehicle to LR rows — 3 queries for the whole
// page instead of 3 per LR (the database is remote now).
async function serializeMany(rows) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const vehicleIds = [...new Set(rows.map((r) => r.vehicle_id).filter(Boolean))];
  const [items, logs, vehicles] = await Promise.all([
    db.prepare("SELECT * FROM lr_items WHERE lr_id = ANY(?::int[]) ORDER BY id").all(ids),
    db.prepare("SELECT * FROM lr_status_log WHERE lr_id = ANY(?::int[]) ORDER BY changed_at, id").all(ids),
    vehicleIds.length ? db.prepare("SELECT * FROM vehicles WHERE id = ANY(?::int[])").all(vehicleIds) : [],
  ]);
  const vehicleById = new Map(vehicles.map((v) => [v.id, v]));
  return rows.map((row) => ({
    ...row,
    items: items.filter((i) => i.lr_id === row.id),
    statusLog: logs.filter((l) => l.lr_id === row.id),
    vehicle: row.vehicle_id ? vehicleById.get(row.vehicle_id) ?? null : null,
  }));
}

const serializeLr = async (row) => (row ? (await serializeMany([row]))[0] : row);

function localDateString(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function nextLrNumber() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `LR-${yy}${mm}-`;
  const c = await count("SELECT COUNT(*) AS c FROM lrs WHERE lr_no LIKE ?", `${prefix}%`);
  const seq = String(c + 101).padStart(3, "0");
  return `${prefix}${seq}`;
}

export const list = route(async (req, res) => {
  const { status, dateFrom, dateTo, search, page = "1", pageSize = "10" } = req.query;

  const clauses = [];
  const params = [];
  if (status && status !== "All") {
    clauses.push("status = ?");
    params.push(status);
  }
  if (dateFrom) {
    clauses.push("lr_date >= ?");
    params.push(dateFrom);
  }
  if (dateTo) {
    clauses.push("lr_date <= ?");
    params.push(dateTo);
  }
  if (search) {
    // ILIKE: case-insensitive, like SQLite's LIKE was.
    clauses.push("(lr_no ILIKE ? OR consignor_name ILIKE ? OR invoice_no ILIKE ?)");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const limit = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 10));
  const offset = (Math.max(1, parseInt(page, 10) || 1) - 1) * limit;

  const [total, rows] = await Promise.all([
    count(`SELECT COUNT(*) AS c FROM lrs ${where}`, ...params),
    db.prepare(`SELECT * FROM lrs ${where} ORDER BY lr_date DESC, id DESC LIMIT ? OFFSET ?`).all(...params, limit, offset),
  ]);

  res.json({
    data: await serializeMany(rows),
    total,
    page: Number(page),
    pageSize: limit,
  });
});

export const summary = route(requireRole(["owner", "dispatcher"]), async (req, res) => {
  const today = localDateString(new Date());
  const thirtyDaysAgo = localDateString(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

  const [
    activeTrips,
    pendingPods,
    totalToday,
    drafts,
    disputed,
    pendingInvoices,
    revenue,
    delayed,
    deliveredToday,
    recentRows,
  ] = await Promise.all([
    count("SELECT COUNT(*) AS c FROM lrs WHERE status = 'In Transit'"),
    count("SELECT COUNT(*) AS c FROM lrs WHERE status = 'In Transit' AND delivery_at IS NOT NULL"),
    count("SELECT COUNT(*) AS c FROM lrs WHERE lr_date = ?", today),
    count("SELECT COUNT(*) AS c FROM lrs WHERE status = 'Draft'"),
    count("SELECT COUNT(*) AS c FROM lrs WHERE status = 'Disputed'"),
    count("SELECT COUNT(*) AS c FROM lrs WHERE status IN ('Delivered') AND (invoice_no IS NULL OR invoice_no = '')"),
    db
      .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM lrs WHERE lr_date >= ? AND status != 'Cancelled'")
      .get(thirtyDaysAgo),
    // "Delayed": still in transit past its own dispatch day — a proxy in the
    // absence of a modeled ETA/expected-transit-time field.
    count("SELECT COUNT(*) AS c FROM lrs WHERE status = 'In Transit' AND lr_date < ?", today),
    count(
      `SELECT COUNT(*) AS c FROM lr_status_log
       WHERE status = 'Delivered' AND ${istDate("changed_at")} = ${TODAY_IST}`
    ),
    db.prepare("SELECT * FROM lrs ORDER BY lr_date DESC, id DESC LIMIT 5").all(),
  ]);

  res.json({
    activeTrips,
    pendingPods,
    totalToday,
    drafts,
    disputed,
    pendingInvoices,
    revenue30d: revenue.total,
    delayed,
    deliveredToday,
    recent: await serializeMany(recentRows),
  });
});

export const reconciliation = route(requireRole(["owner", "dispatcher", "receiver"]), async (req, res) => {
  const [lrs, clients] = await Promise.all([
    db
      .prepare(
        `SELECT id, lr_no, lr_date, consignor_name, amount, status
         FROM lrs
         WHERE status NOT IN ('Draft', 'Cancelled')
         ORDER BY lr_date DESC, id DESC`
      )
      .all(),
    db.prepare("SELECT name, payment_terms_days FROM clients").all(),
  ]);
  const termsByClient = new Map(clients.map((c) => [c.name.toLowerCase(), c.payment_terms_days]));

  const today = new Date();
  const rows = lrs.map((lr) => {
    const termsDays = termsByClient.get(lr.consignor_name?.toLowerCase()) ?? 21;
    const dueDate = new Date(lr.lr_date);
    dueDate.setDate(dueDate.getDate() + termsDays);

    let settlementStatus;
    if (lr.status === "Paid") settlementStatus = "Paid";
    else if (lr.status !== "Delivered") settlementStatus = "Waiting";
    else settlementStatus = today > dueDate ? "Overdue" : "Eligible";

    return {
      id: lr.id,
      lrNo: lr.lr_no,
      lrDate: lr.lr_date,
      consignorName: lr.consignor_name,
      amount: lr.amount,
      dueDate: localDateString(dueDate),
      settlementStatus,
    };
  });

  const totalReceivables = rows
    .filter((r) => r.settlementStatus !== "Paid")
    .reduce((sum, r) => sum + r.amount, 0);
  const pendingRelease = rows
    .filter((r) => r.settlementStatus === "Overdue")
    .reduce((sum, r) => sum + r.amount, 0);
  const activeCount = rows.filter((r) => r.settlementStatus !== "Paid").length;

  res.json({ totalReceivables, pendingRelease, activeCount, rows });
});

export const deliveryPending = route(requireRole(["owner", "dispatcher", "receiver"]), async (req, res) => {
  const rows = await db
    .prepare(
      `SELECT lrs.id, lrs.lr_no, lrs.lr_date, lrs.consignor_name, lrs.from_location, lrs.to_location,
              lrs.updated_at,
              vehicles.vehicle_no, vehicles.vehicle_type, vehicles.driver_name, vehicles.driver_phone
       FROM lrs
       LEFT JOIN vehicles ON vehicles.id = lrs.vehicle_id
       WHERE lrs.status = 'In Transit'
       ORDER BY lrs.updated_at ASC`
    )
    .all();
  res.json(rows);
});

export const deliveryLog = route(requireRole(["owner", "dispatcher", "receiver"]), async (req, res) => {
  const { page = "1", pageSize = "10" } = req.query;
  const limit = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 10));
  const offset = (Math.max(1, parseInt(page, 10) || 1) - 1) * limit;

  const [total, todayCount, rows] = await Promise.all([
    count("SELECT COUNT(*) AS c FROM lr_status_log WHERE status IN ('Delivered', 'Disputed')"),
    count(
      `SELECT COUNT(*) AS c FROM lr_status_log
       WHERE status IN ('Delivered', 'Disputed') AND ${istDate("changed_at")} = ${TODAY_IST}`
    ),
    db
      .prepare(
        `SELECT lr_status_log.status, lr_status_log.changed_at, lr_status_log.note,
                lrs.id AS lr_id, lrs.lr_no, lrs.consignor_name, lrs.from_location,
                vehicles.vehicle_no, vehicles.driver_name,
                users.name AS verified_by
         FROM lr_status_log
         JOIN lrs ON lrs.id = lr_status_log.lr_id
         LEFT JOIN vehicles ON vehicles.id = lrs.vehicle_id
         LEFT JOIN users ON users.id = lr_status_log.changed_by
         WHERE lr_status_log.status IN ('Delivered', 'Disputed')
         ORDER BY lr_status_log.changed_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(limit, offset),
  ]);

  res.json({ data: rows, total, todayCount, page: Number(page), pageSize: limit });
});

export const updateItems = route(requireRole(["receiver"]), async (req, res) => {
  const { id } = req.params;
  const lr = await getLr(id);
  if (!lr) return res.status(404).json({ error: "LR not found" });
  if (lr.status !== "In Transit") {
    return res.status(400).json({ error: "Receiving details can only be recorded while an LR is In Transit" });
  }

  const { items } = req.body || {};
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: "items array is required" });
  }

  await withTransaction(async () => {
    const update = db.prepare(
      `UPDATE lr_items SET received_qty = ?, item_condition = ?, receiving_remarks = ?
       WHERE id = ? AND lr_id = ?`
    );
    for (const item of items) {
      await update.run(
        item.receivedQty ?? null,
        item.itemCondition ?? null,
        item.receivingRemarks ?? null,
        item.id,
        id
      );
    }
  });

  res.json(await serializeLr(await getLr(id)));
});

export const get = route(async (req, res) => {
  const row = await getLr(req.params.id);
  if (!row) return res.status(404).json({ error: "LR not found" });
  res.json(await serializeLr(row));
});

export const create = route(requireRole(["owner", "dispatcher", "creator"]), async (req, res) => {
  const {
    lrDate,
    consignorName,
    consignorAddress,
    consigneeName,
    consigneeAddress,
    vehicleId,
    fromLocation,
    toLocation,
    invoiceNo,
    deliveryAt,
    ewayBillNo,
    freightTerms,
    amount,
    remarks,
    items,
  } = req.body || {};

  if (!consignorName || !consigneeName || !fromLocation || !toLocation || !lrDate) {
    return res.status(400).json({
      error: "consignorName, consigneeName, fromLocation, toLocation, and lrDate are required",
    });
  }

  // No gate-out step: an LR with a vehicle is dispatched (In Transit) as soon as
  // it's created; without a vehicle it waits as Draft until Office marks it In
  // Transit. Delivery and payment stay with the Receiver.
  const lrStatus = vehicleId ? "In Transit" : "Draft";

  const lrId = await withTransaction(async () => {
    const lrNo = await nextLrNumber();
    const result = await db
      .prepare(
        `INSERT INTO lrs
          (lr_no, lr_date, consignor_name, consignor_address, consignee_name, consignee_address,
           vehicle_id, from_location, to_location, invoice_no, delivery_at, eway_bill_no,
           freight_terms, amount, status, remarks, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        lrNo,
        lrDate,
        consignorName.trim(),
        consignorAddress || null,
        consigneeName.trim(),
        consigneeAddress || null,
        vehicleId || null,
        fromLocation.trim(),
        toLocation.trim(),
        invoiceNo || null,
        deliveryAt || null,
        ewayBillNo || null,
        // LR Creator doesn't set freight terms — always the default.
        (req.user?.role !== "creator" && freightTerms) || "To Pay",
        amount || 0,
        lrStatus,
        remarks || null,
        req.user?.id || null
      );

    const lrId = result.lastInsertRowid;

    const insertItem = db.prepare(
      "INSERT INTO lr_items (lr_id, no_of_pkgs, said_to_contain, weight_kg, rate_per_kg, freight_amount, remarks) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    for (const item of items || []) {
      await insertItem.run(
        lrId,
        item.noOfPkgs || null,
        item.saidToContain || null,
        item.weightKg || null,
        item.ratePerKg || null,
        item.freightAmount || null,
        item.remarks || null
      );
    }

    await db
      .prepare("INSERT INTO lr_status_log (lr_id, status, note, changed_by) VALUES (?, ?, ?, ?)")
      .run(lrId, lrStatus, lrStatus === "In Transit" ? "LR created and dispatched" : "LR created", req.user?.id || null);

    if (lrStatus === "In Transit") {
      await db.prepare("UPDATE vehicles SET status = 'In Transit' WHERE id = ?").run(vehicleId);
    }

    return lrId;
  });

  res.status(201).json(await serializeLr(await getLr(lrId)));
});

export const setStatus = route(async (req, res) => {
  const { id } = req.params;
  const { status, note } = req.body || {};
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${STATUSES.join(", ")}` });
  }
  const lr = await getLr(id);
  if (!lr) return res.status(404).json({ error: "LR not found" });

  const allowedRoles = TRANSITIONS[`${lr.status}->${status}`];
  if (!allowedRoles) {
    return res.status(400).json({ error: `Cannot move an LR from ${lr.status} to ${status}` });
  }
  if (!allowedRoles.includes(req.user?.role)) {
    return res.status(403).json({
      error: `Only ${allowedRoles.join(" or ")} can move an LR from ${lr.status} to ${status}`,
    });
  }

  const RECEIVER_NOTE_BY_STATUS = {
    Delivered: "Delivery confirmed",
    Disputed: "Delivery disputed",
    Paid: "Payment received",
  };

  const resolvedNote =
    note ||
    (status === "In Transit" && lr.status === "Draft"
      ? `Dispatched by ${req.user?.name}`
      : req.user?.role === "receiver"
        ? `${RECEIVER_NOTE_BY_STATUS[status] || status} by ${req.user.name}`
        : null);

  await withTransaction(async () => {
    await db.prepare(`UPDATE lrs SET status = ?, updated_at = ${NOW} WHERE id = ?`).run(status, id);
    await db
      .prepare("INSERT INTO lr_status_log (lr_id, status, note, changed_by) VALUES (?, ?, ?, ?)")
      .run(id, status, resolvedNote, req.user?.id || null);

    if (lr.vehicle_id) {
      if (status === "In Transit") {
        await db.prepare("UPDATE vehicles SET status = 'In Transit' WHERE id = ?").run(lr.vehicle_id);
      } else if (VEHICLE_STATUS_BY_LR_STATUS[status]) {
        await db.prepare("UPDATE vehicles SET status = ? WHERE id = ?").run(VEHICLE_STATUS_BY_LR_STATUS[status], lr.vehicle_id);
      }
    }
  });

  res.json(await serializeLr(await getLr(id)));
});

export const update = route(requireRole(["owner", "dispatcher"]), async (req, res) => {
  const { id } = req.params;
  const lr = await getLr(id);
  if (!lr) return res.status(404).json({ error: "LR not found" });

  const {
    consignorName,
    consignorAddress,
    consigneeName,
    consigneeAddress,
    vehicleId,
    fromLocation,
    toLocation,
    invoiceNo,
    deliveryAt,
    ewayBillNo,
    freightTerms,
    amount,
    remarks,
  } = req.body || {};

  await db
    .prepare(
      `UPDATE lrs SET
        consignor_name = COALESCE(?, consignor_name),
        consignor_address = COALESCE(?, consignor_address),
        consignee_name = COALESCE(?, consignee_name),
        consignee_address = COALESCE(?, consignee_address),
        vehicle_id = COALESCE(?::int, vehicle_id),
        from_location = COALESCE(?, from_location),
        to_location = COALESCE(?, to_location),
        invoice_no = COALESCE(?, invoice_no),
        delivery_at = COALESCE(?, delivery_at),
        eway_bill_no = COALESCE(?, eway_bill_no),
        freight_terms = COALESCE(?, freight_terms),
        amount = COALESCE(?::double precision, amount),
        remarks = COALESCE(?, remarks),
        updated_at = ${NOW}
       WHERE id = ?`
    )
    .run(
      consignorName ?? null,
      consignorAddress ?? null,
      consigneeName ?? null,
      consigneeAddress ?? null,
      vehicleId ?? null,
      fromLocation ?? null,
      toLocation ?? null,
      invoiceNo ?? null,
      deliveryAt ?? null,
      ewayBillNo ?? null,
      freightTerms ?? null,
      amount ?? null,
      remarks ?? null,
      id
    );

  res.json(await serializeLr(await getLr(id)));
});
