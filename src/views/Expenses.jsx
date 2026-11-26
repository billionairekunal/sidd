"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { api } from "../lib/api";
import OfficeHeader from "../components/OfficeHeader";
import Select from "../components/Select";
import { CATEGORY_KEYS, guessCategory, guessVehicle, rupees } from "../lib/expenses";
import { todayIST } from "../lib/papers";
import { Modal, Plate } from "./Fleet";

// One colour per category (chips + breakdown bars).
const CAT_COLOR = {
  "Diesel & Fuel": "#ea580c",
  "Mathadi & Loading": "#7c3aed",
  "Driver Payment": "#2563eb",
  "Trip Payment": "#0d9488",
  "Maintenance & Repairs": "#0891b2",
  "FASTag & Toll": "#16a34a",
  "RTO & Papers": "#db2777",
  Salary: "#ca8a04",
  "GPS & Office": "#475569",
  "Personal & Owner": "#9333ea",
  Other: "#94a3b8",
};

const shiftMonth = (m, by) => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + by, 1));
  return d.toISOString().slice(0, 7);
};
const monthName = (m, style = "long") =>
  new Date(`${m}-01T00:00:00`).toLocaleDateString("en-IN", { month: style, year: "numeric" });
const dayName = (d) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
const norm = (s) => (s || "").toLowerCase();

function CatChip({ cat }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-secondary whitespace-nowrap">
      <span className="w-2 h-2 rounded-[999px] shrink-0" style={{ backgroundColor: CAT_COLOR[cat] || CAT_COLOR.Other }} />
      {cat}
    </span>
  );
}

export default function Expenses() {
  const today = todayIST();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [data, setData] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [payer, setPayer] = useState("all");
  const [cat, setCat] = useState("all");
  const [editing, setEditing] = useState(null);

  const load = (m = month) =>
    api.expenses
      .list(m)
      .then(setData)
      .catch((err) => setError(err.message));

  useEffect(() => {
    setData(null);
    load(month);
  }, [month]);
  useEffect(() => {
    api.vehicles.list().then(setVehicles).catch(() => {});
  }, []);

  const rows = data?.rows || [];
  const shown = useMemo(
    () =>
      rows.filter(
        (r) =>
          (payer === "all" || r.paid_by === payer) &&
          (cat === "all" || r.category === cat) &&
          (!q || norm(`${r.paid_to} ${r.reason} ${r.paid_by} ${r.vehicle_no}`).includes(norm(q)))
      ),
    [rows, payer, cat, q]
  );
  const sum = (list) => list.reduce((s, r) => s + r.amount, 0);
  const monthTotal = sum(rows);
  const shownTotal = sum(shown);
  const todayTotal = sum(rows.filter((r) => r.exp_date === today));

  const groupBy = (key) =>
    Object.entries(
      rows.reduce((acc, r) => {
        acc[r[key]] = (acc[r[key]] || 0) + r.amount;
        return acc;
      }, {})
    ).sort((a, b) => b[1] - a[1]);
  const byPayer = groupBy("paid_by");
  const byCat = groupBy("category");

  const days = useMemo(() => {
    const map = new Map();
    for (const r of shown) map.set(r.exp_date, [...(map.get(r.exp_date) || []), r]);
    return [...map.entries()];
  }, [shown]);

  async function remove(r) {
    if (!confirm(`Delete ${rupees(r.amount)} paid to ${r.paid_to} on ${dayName(r.exp_date)}?`)) return;
    try {
      await api.expenses.remove(r.id);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function exportCsv() {
    const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [
      ["Date", "Paid By", "Paid To", "Reason", "Category", "Vehicle", "Amount"],
      ...[...shown].reverse().map((r) => [r.exp_date, r.paid_by, r.paid_to, r.reason, r.category, r.vehicle_no, r.amount]),
      ["", "", "", "", "", "TOTAL", shownTotal],
    ];
    const blob = new Blob(["﻿" + lines.map((l) => l.map(cell).join(",")).join("\r\n")], { type: "text/csv" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `Expenses-${month}.csv` });
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // Year strip: the 12 months of the selected year.
  const year = month.slice(0, 4);
  const yearMonths = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const totals = Object.fromEntries((data?.months || []).map((m) => [m.month, m.total]));
  const maxMonth = Math.max(1, ...yearMonths.map((m) => totals[m] || 0));
  const filtered = payer !== "all" || cat !== "all" || q;

  return (
    <div className="flex-1 flex flex-col">
      <OfficeHeader />
      <div className="p-4 md:px-xxl md:py-xl space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[22px] md:text-[26px] font-bold text-ink-secondary tracking-tight">Daily Expenses</h1>
            <p className="text-[13.5px] text-ink-mute mt-0.5">Every rupee paid out — who paid, to whom and why.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-md border border-hairline bg-white">
              <button onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month" className="w-9 h-9 flex items-center justify-center text-ink-mute hover:text-ink-secondary">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <input
                type="month"
                value={month}
                onChange={(e) => e.target.value && setMonth(e.target.value)}
                className="h-9 px-1 text-[14px] font-semibold text-ink-secondary bg-transparent focus:outline-none"
                aria-label="Month"
              />
              <button onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month" className="w-9 h-9 flex items-center justify-center text-ink-mute hover:text-ink-secondary">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={exportCsv}
              disabled={!shown.length}
              className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md border border-primary/60 bg-white text-primary hover:bg-primary-container text-[13px] font-semibold disabled:opacity-50"
            >
              <Download className="w-4 h-4" /> Excel (CSV)
            </button>
          </div>
        </header>

        {error && <p className="text-error text-sm">{error}</p>}

        {/* Quick entry — as fast as typing a row in Excel */}
        <section className="bg-surface rounded-lg border border-hairline p-4">
          <h2 className="text-[14px] font-bold text-ink-secondary mb-3 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-primary" strokeWidth={2.6} /> Add expense
          </h2>
          <ExpenseForm
            key={month}
            vehicles={vehicles}
            payers={data?.payers || []}
            payees={data?.payees || []}
            defaultDate={month === today.slice(0, 7) ? today : `${month}-01`}
            onSave={async (v) => {
              const saved = await api.expenses.create(v);
              if (saved.exp_date.slice(0, 7) === month) load();
              else setMonth(saved.exp_date.slice(0, 7));
            }}
          />
        </section>

        {/* Summary */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-surface rounded-lg border border-hairline p-5">
            <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-ink-mute">{monthName(month)}</p>
            <p className="text-[30px] font-bold text-ink-secondary leading-tight mt-1">{data ? rupees(monthTotal) : "—"}</p>
            <p className="text-[12.5px] text-ink-mute">{rows.length} entries{month === today.slice(0, 7) ? ` · today ${rupees(todayTotal)}` : ""}</p>
            <div className="mt-4 space-y-1.5">
              {byPayer.map(([name, amt]) => (
                <button
                  key={name}
                  onClick={() => setPayer(payer === name ? "all" : name)}
                  className={`w-full flex items-center justify-between text-[13px] rounded-md px-2 py-1 ${payer === name ? "bg-primary-container font-semibold" : "hover:bg-surface-container-low"}`}
                >
                  <span className="text-ink-secondary">{name}</span>
                  <span className="text-ink-secondary font-semibold">{rupees(amt)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-surface rounded-lg border border-hairline p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-ink-mute">Where the money went</p>
              {cat !== "all" && (
                <button onClick={() => setCat("all")} className="text-[12px] text-primary font-semibold">Show all</button>
              )}
            </div>
            {!byCat.length && <p className="text-[13px] text-ink-mute">No expenses this month yet.</p>}
            <div className="space-y-2">
              {byCat.map(([name, amt]) => (
                <button
                  key={name}
                  onClick={() => setCat(cat === name ? "all" : name)}
                  className={`w-full grid grid-cols-[150px_1fr_96px] sm:grid-cols-[180px_1fr_110px] items-center gap-3 text-left rounded-md px-1.5 py-1 ${
                    cat === name ? "bg-primary-container" : "hover:bg-surface-container-low"
                  } ${cat !== "all" && cat !== name ? "opacity-45" : ""}`}
                >
                  <CatChip cat={name} />
                  <span className="h-2.5 rounded-[999px] bg-surface-container overflow-hidden">
                    <span className="block h-full rounded-[999px]" style={{ width: `${(amt / byCat[0][1]) * 100}%`, backgroundColor: CAT_COLOR[name] || CAT_COLOR.Other }} />
                  </span>
                  <span className="text-[13px] font-semibold text-ink-secondary text-right">
                    {rupees(amt)}
                    <span className="block text-[10.5px] font-normal text-ink-mute">{Math.round((amt / monthTotal) * 100)}%</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Year at a glance */}
        <section className="bg-surface rounded-lg border border-hairline p-4">
          <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-ink-mute mb-3">{year} month by month</p>
          <div className="grid grid-cols-12 gap-1.5 items-end h-[92px]">
            {yearMonths.map((m) => {
              const t = totals[m] || 0;
              return (
                <button key={m} onClick={() => setMonth(m)} title={`${monthName(m)}: ${rupees(t)}`} className="h-full flex flex-col justify-end items-center gap-1 group">
                  <span
                    className={`w-full max-w-[44px] rounded-t-[3px] ${m === month ? "bg-primary" : t ? "bg-[#b6dde8] group-hover:bg-primary-soft" : "bg-surface-container"}`}
                    style={{ height: `${Math.max(3, (t / maxMonth) * 64)}px` }}
                  />
                  <span className={`text-[10.5px] ${m === month ? "font-bold text-primary" : "text-ink-mute"}`}>
                    {new Date(`${m}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short" })}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="flex items-center gap-2 h-9 px-2.5 rounded-md bg-white border border-hairline focus-within:border-primary flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 text-ink-mute" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search paid to, reason, vehicle…" className="flex-1 min-w-0 bg-transparent text-[13.5px] focus:outline-none" />
            {q && (
              <button onClick={() => setQ("")} aria-label="Clear search">
                <X className="w-4 h-4 text-ink-mute" />
              </button>
            )}
          </label>
          <Select size="sm" className="w-44" value={payer} onChange={setPayer} options={[{ value: "all", label: "Everyone" }, ...byPayer.map(([n]) => ({ value: n, label: n }))]} />
          <Select size="sm" className="w-52" value={cat} onChange={setCat} options={[{ value: "all", label: "All categories" }, ...CATEGORY_KEYS.map((c) => ({ value: c, label: c }))]} />
          {filtered && (
            <span className="text-[13px] text-ink-mute">
              {shown.length} entries · <b className="text-ink-secondary">{rupees(shownTotal)}</b>
            </span>
          )}
        </div>

        {/* Day-by-day list */}
        {!data ? (
          <p className="text-ink-mute text-sm py-10 text-center">Loading expenses…</p>
        ) : !days.length ? (
          <p className="rounded-lg border border-dashed border-hairline bg-white py-12 text-center text-[14px] text-ink-mute">
            {rows.length ? "Nothing matches these filters." : `No expenses in ${monthName(month)}.`}
          </p>
        ) : (
          <div className="space-y-4">
            {days.map(([date, list]) => (
              <section key={date} className="bg-surface rounded-lg border border-hairline overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-canvas-soft border-b border-hairline">
                  <p className="text-[13.5px] font-bold text-ink-secondary">
                    {dayName(date)}
                    {date === today && <span className="ml-2 text-[11px] font-semibold text-primary">TODAY</span>}
                  </p>
                  <p className="text-[13.5px] font-bold text-ink-secondary">
                    {rupees(sum(list))} <span className="text-[11.5px] font-normal text-ink-mute">· {list.length}</span>
                  </p>
                </div>
                <ul className="divide-y divide-hairline">
                  {list.map((r) => (
                    <li key={r.id} className="group grid grid-cols-[1fr_auto] md:grid-cols-[110px_minmax(0,1.3fr)_minmax(0,1.4fr)_190px_120px_64px] gap-x-4 gap-y-1 items-center px-4 py-2.5 hover:bg-surface-container-low">
                      <span className="hidden md:block text-[12.5px] text-ink-mute truncate">{r.paid_by}</span>
                      <span className="min-w-0">
                        <span className="block text-[14px] font-semibold text-ink-secondary truncate">{r.paid_to}</span>
                        <span className="md:hidden block text-[12px] text-ink-mute truncate">
                          {[r.reason, r.paid_by].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="hidden md:flex items-center gap-2 min-w-0 text-[13px] text-[#46525c]">
                        {r.vehicle_no && <Plate no={r.vehicle_no} small />}
                        <span className="truncate">{r.reason || ""}</span>
                      </span>
                      <span className="hidden md:block">
                        <CatChip cat={r.category} />
                      </span>
                      <span className="text-[14.5px] font-bold text-ink-secondary text-right whitespace-nowrap">{rupees(r.amount)}</span>
                      <span className="col-span-2 md:col-span-1 flex md:justify-end gap-1 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100">
                        <span className="md:hidden flex-1 flex items-center gap-2">
                          <CatChip cat={r.category} />
                          {r.vehicle_no && <Plate no={r.vehicle_no} small />}
                        </span>
                        <button onClick={() => setEditing(r)} aria-label="Edit" className="w-8 h-8 flex items-center justify-center rounded-md text-ink-mute hover:text-primary hover:bg-white">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => remove(r)} aria-label="Delete" className="w-8 h-8 flex items-center justify-center rounded-md text-ink-mute hover:text-error hover:bg-white">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <Modal title="Edit expense" onClose={() => setEditing(null)} wide>
          <ExpenseForm
            initial={editing}
            vehicles={vehicles}
            payers={data?.payers || []}
            payees={data?.payees || []}
            submitLabel="Save changes"
            onSave={async (v) => {
              await api.expenses.update(editing.id, v);
              setEditing(null);
              load();
            }}
          />
        </Modal>
      )}
    </div>
  );
}

const LAST_PAYER = "expenses_last_paid_by";

function ExpenseForm({ initial, vehicles, payers, payees, defaultDate, submitLabel = "Add", onSave }) {
  const blank = () => ({
    exp_date: defaultDate,
    paid_by: (typeof window !== "undefined" && localStorage.getItem(LAST_PAYER)) || "",
    paid_to: "",
    reason: "",
    amount: "",
    category: "Other",
    vehicle_id: "",
  });
  const [f, setF] = useState(() =>
    initial ? { ...initial, amount: String(initial.amount), reason: initial.reason || "", vehicle_id: initial.vehicle_id || "" } : blank()
  );
  // Category and vehicle follow what's typed until the user picks one themselves.
  const [picked, setPicked] = useState({ category: !!initial, vehicle_id: !!initial });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const firstRef = useRef(null);

  function set(k, v) {
    setF((x) => {
      const next = { ...x, [k]: v };
      if (k === "paid_to" || k === "reason") {
        if (!picked.category) next.category = guessCategory(next.paid_to, next.reason);
        if (!picked.vehicle_id) next.vehicle_id = guessVehicle(`${next.paid_to} ${next.reason}`, vehicles)?.id || "";
      }
      return next;
    });
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave({ ...f, amount: Number(f.amount) });
      localStorage.setItem(LAST_PAYER, f.paid_by);
      if (!initial) {
        // Keep date and payer for the next row, like the Excel sheet.
        setF((x) => ({ ...blank(), exp_date: x.exp_date, paid_by: x.paid_by }));
        setPicked({ category: false, vehicle_id: false });
        firstRef.current?.focus();
      }
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  const label = "block text-[11.5px] font-semibold text-ink-mute mb-1";
  return (
    <form onSubmit={submit}>
      <div className={`grid grid-cols-2 gap-3 ${initial ? "" : "lg:grid-cols-[150px_150px_1.2fr_1.4fr_130px]"}`}>
        <label>
          <span className={label}>Date</span>
          <input type="date" className="input" value={f.exp_date} onChange={(e) => set("exp_date", e.target.value)} required />
        </label>
        <label>
          <span className={label}>Paid by</span>
          <input className="input" list="exp-payers" value={f.paid_by} onChange={(e) => set("paid_by", e.target.value)} placeholder="Vinod Sir" required />
        </label>
        <label className="col-span-2 lg:col-span-1">
          <span className={label}>Paid to</span>
          <input ref={firstRef} className="input" list="exp-payees" value={f.paid_to} onChange={(e) => set("paid_to", e.target.value)} placeholder="Person, shop or vehicle" required />
        </label>
        <label className="col-span-2 lg:col-span-1">
          <span className={label}>Reason</span>
          <input className="input" value={f.reason} onChange={(e) => set("reason", e.target.value)} placeholder="e.g. 1238 diesel, mathadi, advance" />
        </label>
        <label className="col-span-2 lg:col-span-1">
          <span className={label}>Amount (₹)</span>
          <input type="number" min="0" step="0.01" inputMode="decimal" className="input font-semibold" value={f.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0" required />
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-3 mt-3">
        <label className="w-56">
          <span className={label}>Category {!picked.category && f.paid_to && <span className="font-normal">· auto</span>}</span>
          <Select
            value={f.category}
            onChange={(v) => {
              setPicked((p) => ({ ...p, category: true }));
              setF((x) => ({ ...x, category: v }));
            }}
            options={CATEGORY_KEYS.map((c) => ({ value: c, label: c }))}
          />
        </label>
        <label className="w-56">
          <span className={label}>Vehicle {!picked.vehicle_id && f.vehicle_id && <span className="font-normal">· auto</span>}</span>
          <Select
            value={String(f.vehicle_id || "")}
            onChange={(v) => {
              setPicked((p) => ({ ...p, vehicle_id: true }));
              setF((x) => ({ ...x, vehicle_id: v }));
            }}
            options={[{ value: "", label: "No vehicle" }, ...vehicles.map((v) => ({ value: String(v.id), label: v.vehicle_no }))]}
          />
        </label>
        <div className="flex-1" />
        {error && <p className="text-error text-sm w-full sm:w-auto">{error}</p>}
        <button disabled={busy} className="h-10 px-6 rounded-md bg-primary hover:bg-primary-press text-white text-[14px] font-semibold shadow-sm disabled:opacity-60">
          {busy ? "Saving…" : submitLabel}
        </button>
      </div>
      <datalist id="exp-payers">
        {payers.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <datalist id="exp-payees">
        {payees.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
    </form>
  );
}
