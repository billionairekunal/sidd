"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle, ArrowDownRight, ArrowUpRight, Check, ChevronLeft, ChevronRight, Copy, Download,
  Pencil, Plus, Search, Tags, Trash2, Truck, Users, List, PieChart, X,
} from "lucide-react";
import { api } from "../lib/api";
import OfficeHeader from "../components/OfficeHeader";
import Select from "../components/Select";
import { CATEGORY_KEYS, guessCategory, guessVehicle, rupees } from "../lib/expenses";
import { todayIST } from "../lib/papers";
import { Modal, Plate } from "./Fleet";

// One colour per category (chips, bars, truck split).
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
const catColor = (c) => CAT_COLOR[c] || CAT_COLOR.Other;

// ---- Dates (YYYY-MM-DD strings, worked in UTC so no timezone drift) ----
const D = (s) => new Date(`${s}T00:00:00Z`);
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => {
  const d = D(s);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
const daysBetween = (a, b) => Math.round((D(b) - D(a)) / 864e5) + 1;
const fmt = (s, o) => D(s).toLocaleDateString("en-IN", { timeZone: "UTC", ...o });
const dayName = (s) => fmt(s, { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
const short = (s) => fmt(s, { day: "2-digit", month: "short" });

// A period is { unit, from, to }; unit decides what the ‹ › arrows step by.
function periodOf(unit, a) {
  const y = +a.slice(0, 4), m = +a.slice(5, 7);
  if (unit === "day") return { unit, from: a, to: a };
  if (unit === "week") {
    const mon = addDays(a, -((D(a).getUTCDay() + 6) % 7));
    return { unit, from: mon, to: addDays(mon, 6) };
  }
  if (unit === "month") return { unit, from: `${a.slice(0, 7)}-01`, to: iso(new Date(Date.UTC(y, m, 0))) };
  return { unit: "year", from: `${y}-01-01`, to: `${y}-12-31` };
}
function shiftPeriod(p, by) {
  if (p.unit === "month") return periodOf("month", iso(new Date(Date.UTC(+p.from.slice(0, 4), +p.from.slice(5, 7) - 1 + by, 1))));
  if (p.unit === "year") return periodOf("year", `${+p.from.slice(0, 4) + by}-01-01`);
  const len = daysBetween(p.from, p.to);
  return { ...p, from: addDays(p.from, len * by), to: addDays(p.to, len * by) };
}
function periodLabel(p) {
  if (p.unit === "day") return dayName(p.from);
  if (p.unit === "month") return fmt(p.from, { month: "long", year: "numeric" });
  if (p.unit === "year") return p.from.slice(0, 4);
  return `${short(p.from)} – ${fmt(p.to, { day: "2-digit", month: "short", year: "numeric" })}`;
}

const norm = (s) => (s || "").toLowerCase();
const sum = (list) => list.reduce((s, r) => s + r.amount, 0);
const groupSum = (rows, keyOf) => {
  const map = new Map();
  for (const r of rows) {
    const k = keyOf(r);
    const g = map.get(k) || { key: k, total: 0, count: 0, last: "", cats: {} };
    g.total += r.amount;
    g.count += 1;
    if (r.exp_date > g.last) g.last = r.exp_date;
    g.cats[r.category] = (g.cats[r.category] || 0) + r.amount;
    map.set(k, g);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
};
const lakh = (n) => (n >= 1e5 ? `₹${(n / 1e5).toFixed(n >= 1e7 ? 0 : 1)}L` : n >= 1e3 ? `₹${Math.round(n / 1e3)}k` : rupees(n));

function CatChip({ cat }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-secondary whitespace-nowrap">
      <span className="w-2 h-2 rounded-[999px] shrink-0" style={{ backgroundColor: catColor(cat) }} />
      {cat}
    </span>
  );
}

// Thin stacked bar of a group's category split.
function SplitBar({ cats, total }) {
  return (
    <span className="flex h-2 w-full rounded-[999px] overflow-hidden bg-surface-container">
      {Object.entries(cats)
        .sort((a, b) => b[1] - a[1])
        .map(([c, v]) => (
          <span key={c} title={`${c}: ${rupees(v)}`} style={{ width: `${(v / total) * 100}%`, backgroundColor: catColor(c) }} />
        ))}
    </span>
  );
}

const TABS = [
  { key: "entries", label: "Entries", icon: List },
  { key: "trucks", label: "By truck", icon: Truck },
  { key: "people", label: "By person", icon: Users },
  { key: "categories", label: "By category", icon: PieChart },
];
const PAGE = 250;

export default function Expenses() {
  const today = todayIST();
  const presets = [
    { label: "Today", p: periodOf("day", today) },
    { label: "This week", p: periodOf("week", today) },
    { label: "This month", p: periodOf("month", today) },
    { label: "Last month", p: shiftPeriod(periodOf("month", today), -1) },
    { label: "This year", p: periodOf("year", today) },
  ];
  const [period, setPeriod] = useState(presets[2].p);
  const [data, setData] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("entries");
  // Filters
  const [q, setQ] = useState("");
  const [payer, setPayer] = useState("all");
  const [cat, setCat] = useState("all");
  const [truck, setTruck] = useState("all"); // "all" | "none" | vehicle_no
  const [person, setPerson] = useState("");
  const [day, setDay] = useState("");
  // Entry dialogs + bulk selection
  const [dialog, setDialog] = useState(null); // { mode: "add"|"edit", row? }
  const [sel, setSel] = useState(() => new Set());
  const [bulkCat, setBulkCat] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const prev = shiftPeriod(period, -1);
  const load = () =>
    api.expenses
      .list({ from: period.from, to: period.to, prev_from: prev.from, prev_to: prev.to })
      .then((d) => {
        setData(d);
        setError("");
      })
      .catch((err) => setError(err.message));

  useEffect(() => {
    setData(null);
    setDay("");
    setSel(new Set());
    setLimit(PAGE);
    load();
  }, [period.from, period.to]);
  useEffect(() => {
    api.vehicles.list().then(setVehicles).catch(() => {});
  }, []);
  // "N" opens a new entry from anywhere on the page.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key.toLowerCase() !== "n" || e.ctrlKey || e.metaKey || e.altKey || dialog) return;
      if (/input|textarea|select/i.test(e.target.tagName) || e.target.isContentEditable) return;
      e.preventDefault();
      setDialog({ mode: "add" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog]);

  const rows = data?.rows || [];
  // Every filter except truck → the truck tab can compare trucks; same idea for person.
  const match = (r, skip) =>
    (payer === "all" || r.paid_by === payer) &&
    (cat === "all" || r.category === cat) &&
    (!day || r.exp_date === day) &&
    (skip === "truck" || truck === "all" || (truck === "none" ? !r.vehicle_no : r.vehicle_no === truck)) &&
    (skip === "person" || !person || r.paid_to === person) &&
    (!q || norm(`${r.paid_to} ${r.reason} ${r.paid_by} ${r.vehicle_no} ${r.amount}`).includes(norm(q)));
  const shown = useMemo(() => rows.filter((r) => match(r)), [rows, payer, cat, day, truck, person, q]);
  const total = sum(rows);
  const shownTotal = sum(shown);
  const filtered = payer !== "all" || cat !== "all" || truck !== "all" || person || day || q;
  const clearFilters = () => {
    setPayer("all");
    setCat("all");
    setTruck("all");
    setPerson("");
    setDay("");
    setQ("");
  };

  // KPIs
  const prevTotal = data?.prev?.total ?? null;
  const change = prevTotal ? ((total - prevTotal) / prevTotal) * 100 : null;
  const elapsed = Math.max(1, daysBetween(period.from, period.to < today ? period.to : today < period.from ? period.from : today));
  const biggest = rows.reduce((b, r) => (!b || r.amount > b.amount ? r : b), null);
  const other = rows.filter((r) => r.category === "Other");

  // Trend: per day for ranges up to ~2 months, else per month.
  const daily = daysBetween(period.from, period.to) <= 62;
  const trend = useMemo(() => {
    const base = rows.filter((r) => match({ ...r, exp_date: day || r.exp_date }));
    const by = {};
    for (const r of base) {
      const k = daily ? r.exp_date : r.exp_date.slice(0, 7);
      by[k] = (by[k] || 0) + r.amount;
    }
    const keys = [];
    if (daily) for (let d = period.from; d <= period.to; d = addDays(d, 1)) keys.push(d);
    else for (let d = period.from; d <= period.to; d = iso(new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7), 1)))) keys.push(d.slice(0, 7));
    return keys.map((k) => ({ k, v: by[k] || 0 }));
  }, [rows, daily, period.from, period.to, payer, cat, truck, person, q]);
  const trendMax = Math.max(1, ...trend.map((t) => t.v));

  const days = useMemo(() => {
    const map = new Map();
    for (const r of shown.slice(0, limit)) map.set(r.exp_date, [...(map.get(r.exp_date) || []), r]);
    return [...map.entries()];
  }, [shown, limit]);
  const dayTotals = useMemo(() => {
    const t = {};
    for (const r of shown) t[r.exp_date] = (t[r.exp_date] || 0) + r.amount;
    return t;
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
  async function setCategory(ids, category) {
    try {
      await api.expenses.bulk(ids, category);
      setData((d) => ({ ...d, rows: d.rows.map((r) => (ids.includes(r.id) ? { ...r, category } : r)) }));
      setSel(new Set());
      setBulkCat("");
    } catch (err) {
      setError(err.message);
    }
  }
  const toggle = (ids, on) =>
    setSel((s) => {
      const n = new Set(s);
      ids.forEach((id) => (on ? n.add(id) : n.delete(id)));
      return n;
    });
  const selRows = rows.filter((r) => sel.has(r.id));

  function exportCsv() {
    const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [
      ["Date", "Paid By", "Paid To", "Reason", "Category", "Vehicle", "Amount"],
      ...[...shown].reverse().map((r) => [r.exp_date, r.paid_by, r.paid_to, r.reason, r.category, r.vehicle_no, r.amount]),
      ["", "", "", "", "", "TOTAL", shownTotal],
    ];
    const blob = new Blob(["﻿" + lines.map((l) => l.map(cell).join(",")).join("\r\n")], { type: "text/csv" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `Expenses ${period.from} to ${period.to}.csv` });
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const goEntries = (set) => {
    set();
    setTab("entries");
    setLimit(PAGE);
  };
  const payers = groupSum(rows, (r) => r.paid_by);
  const activePreset = presets.find((x) => x.p.from === period.from && x.p.to === period.to)?.label;

  return (
    <div className="flex-1 flex flex-col">
      <OfficeHeader />
      <div className="p-4 md:px-xxl md:py-xl space-y-4 pb-28 md:pb-xl">
        {/* Title + actions */}
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[22px] md:text-[26px] font-bold text-ink-secondary tracking-tight">Expenses</h1>
            <p className="text-[13.5px] text-ink-mute mt-0.5">Every rupee paid out — who paid, to whom, for which truck.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCsv}
              disabled={!shown.length}
              className="h-10 px-3 inline-flex items-center gap-1.5 rounded-md border border-hairline bg-white text-ink-secondary hover:border-primary hover:text-primary text-[13px] font-semibold disabled:opacity-50"
            >
              <Download className="w-4 h-4" /> Excel
            </button>
            <button
              onClick={() => setDialog({ mode: "add" })}
              className="hidden md:inline-flex h-10 px-4 items-center gap-1.5 rounded-md bg-primary hover:bg-primary-press text-white text-[14px] font-semibold shadow-sm"
            >
              <Plus className="w-4 h-4" strokeWidth={2.6} /> Add expense
              <kbd className="ml-1 text-[10.5px] font-semibold bg-white/20 rounded-[3px] px-1.5 py-[1px]">N</kbd>
            </button>
          </div>
        </header>

        {/* Period picker */}
        <section className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-md border border-hairline bg-white">
            <button onClick={() => setPeriod(shiftPeriod(period, -1))} aria-label="Previous period" className="w-9 h-9 flex items-center justify-center text-ink-mute hover:text-ink-secondary">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-1 min-w-[150px] text-center text-[14px] font-bold text-ink-secondary">{periodLabel(period)}</span>
            <button onClick={() => setPeriod(shiftPeriod(period, 1))} aria-label="Next period" className="w-9 h-9 flex items-center justify-center text-ink-mute hover:text-ink-secondary">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-md bg-surface-container">
            {presets.map((x) => (
              <button
                key={x.label}
                onClick={() => setPeriod(x.p)}
                className={`h-7 px-3 rounded-[4px] text-[12.5px] font-semibold ${activePreset === x.label ? "bg-white text-primary shadow-sm" : "text-ink-mute hover:text-ink-secondary"}`}
              >
                {x.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-[12.5px] text-ink-mute">
            <input type="date" value={period.from} max={period.to} onChange={(e) => e.target.value && setPeriod({ unit: "custom", from: e.target.value, to: period.to })} className="h-9 px-2 rounded-md border border-hairline bg-white text-ink-secondary" aria-label="From date" />
            to
            <input type="date" value={period.to} min={period.from} onChange={(e) => e.target.value && setPeriod({ unit: "custom", from: period.from, to: e.target.value })} className="h-9 px-2 rounded-md border border-hairline bg-white text-ink-secondary" aria-label="To date" />
          </div>
        </section>

        {error && <p className="text-error text-sm">{error}</p>}

        {/* KPIs */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi label="Total spent" value={data ? rupees(total) : "—"}>
            {change != null && (
              <span className={`inline-flex items-center gap-0.5 font-semibold ${change > 0 ? "text-error" : "text-[#15803d]"}`}>
                {change > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                {Math.abs(change).toFixed(0)}%
              </span>
            )}{" "}
            {prevTotal ? <>vs {rupees(prevTotal)} before</> : "Nothing in the period before"}
          </Kpi>
          <Kpi label="Entries" value={data ? rows.length : "—"}>
            avg {rupees(Math.round(total / elapsed))} / day
          </Kpi>
          <Kpi
            label="Biggest payment"
            value={biggest ? rupees(biggest.amount) : "—"}
            onClick={biggest ? () => goEntries(() => { clearFilters(); setQ(String(biggest.paid_to)); }) : undefined}
          >
            {biggest ? <span className="truncate block">{biggest.paid_to} · {short(biggest.exp_date)}</span> : "No entries"}
          </Kpi>
          <Kpi
            label="Needs a category"
            value={data ? other.length : "—"}
            tone={other.length ? "warn" : "ok"}
            onClick={other.length ? () => goEntries(() => { clearFilters(); setCat("Other"); }) : undefined}
          >
            {other.length ? <>{rupees(sum(other))} in “Other” · tap to sort</> : "All sorted"}
          </Kpi>
        </section>

        {/* Trend */}
        {trend.length > 1 && (
          <section className="bg-surface rounded-lg border border-hairline p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-ink-mute">{daily ? "Day by day" : "Month by month"}</p>
              {day ? (
                <button onClick={() => setDay("")} className="text-[12px] text-primary font-semibold">Showing {short(day)} · show all days</button>
              ) : (
                <span className="text-[11.5px] text-ink-mute">{daily ? "Tap a day to see its entries" : "Tap a month to open it"}</span>
              )}
            </div>
            <div className="flex items-end gap-[3px] h-[110px]">
              {trend.map(({ k, v }) => {
                const on = daily ? day === k : false;
                const future = daily && k > today;
                return (
                  <button
                    key={k}
                    disabled={future}
                    onClick={() => (daily ? setDay(day === k ? "" : k) : setPeriod(periodOf("month", `${k}-01`)))}
                    title={`${daily ? dayName(k) : fmt(`${k}-01`, { month: "long", year: "numeric" })}: ${rupees(v)}`}
                    className="flex-1 min-w-0 h-full flex flex-col justify-end items-center gap-1 group"
                  >
                    <span
                      className={`w-full max-w-[40px] rounded-t-[3px] ${on ? "bg-primary" : day ? "bg-surface-container" : v ? "bg-[#9fd0de] group-hover:bg-primary" : "bg-surface-container"}`}
                      style={{ height: `${v ? Math.max(4, (v / trendMax) * 86) : 2}px` }}
                    />
                    <span className={`text-[9.5px] leading-none ${on ? "font-bold text-primary" : k === today ? "font-bold text-ink-secondary" : "text-ink-mute"}`}>
                      {daily ? (trend.length <= 14 ? fmt(k, { weekday: "short", day: "numeric" }) : +k.slice(8)) : fmt(`${k}-01`, { month: "short" })}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Tabs */}
        <nav className="flex gap-1 border-b border-hairline overflow-x-auto no-scrollbar">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`h-10 px-3 inline-flex items-center gap-1.5 text-[13.5px] border-b-2 -mb-px whitespace-nowrap ${
                tab === key ? "border-primary text-primary font-semibold" : "border-transparent text-ink-mute hover:text-ink-secondary"
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </nav>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 h-9 px-2.5 rounded-md bg-white border border-hairline focus-within:border-primary flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 text-ink-mute" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, reason, truck, amount…" className="flex-1 min-w-0 bg-transparent text-[13.5px] focus:outline-none" />
            {q && (
              <button onClick={() => setQ("")} aria-label="Clear search">
                <X className="w-4 h-4 text-ink-mute" />
              </button>
            )}
          </label>
          <Select size="sm" className="w-40" value={payer} onChange={setPayer} options={[{ value: "all", label: "Paid by: anyone" }, ...payers.map((g) => ({ value: g.key, label: g.key }))]} />
          <Select size="sm" className="w-48" value={cat} onChange={setCat} options={[{ value: "all", label: "All categories" }, ...CATEGORY_KEYS.map((c) => ({ value: c, label: c }))]} />
          <Select
            size="sm"
            className="w-44"
            value={truck}
            onChange={setTruck}
            options={[{ value: "all", label: "All trucks" }, { value: "none", label: "No truck linked" }, ...vehicles.map((v) => ({ value: v.vehicle_no, label: v.vehicle_no }))]}
          />
          {person && (
            <span className="h-8 pl-2.5 pr-1 inline-flex items-center gap-1 rounded-[999px] bg-primary-container text-[12.5px] font-semibold text-ink-secondary">
              {person}
              <button onClick={() => setPerson("")} aria-label="Remove person filter" className="w-6 h-6 flex items-center justify-center">
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}
          {filtered && (
            <>
              <span className="text-[13px] text-ink-mute">
                {shown.length} entries · <b className="text-ink-secondary">{rupees(shownTotal)}</b>
              </span>
              <button onClick={clearFilters} className="text-[12.5px] text-primary font-semibold">Clear filters</button>
            </>
          )}
        </div>

        {!data ? (
          <p className="text-ink-mute text-sm py-10 text-center">Loading expenses…</p>
        ) : tab === "trucks" ? (
          <GroupTable
            groups={groupSum(rows.filter((r) => match(r, "truck")), (r) => r.vehicle_no || "")}
            first="Truck"
            name={(g) => (g.key ? <Plate no={g.key} small /> : <span className="text-[13px] text-ink-mute">No truck linked</span>)}
            onPick={(g) => goEntries(() => setTruck(g.key || "none"))}
          />
        ) : tab === "people" ? (
          <GroupTable
            groups={groupSum(rows.filter((r) => match(r, "person")), (r) => r.paid_to)}
            first="Paid to"
            name={(g) => <span className="text-[14px] font-semibold text-ink-secondary truncate">{g.key}</span>}
            onPick={(g) => goEntries(() => setPerson(g.key))}
          />
        ) : tab === "categories" ? (
          <Breakdowns rows={shown} payers={groupSum(shown, (r) => r.paid_by)} onCat={(c) => goEntries(() => setCat(c))} onPayer={(p) => goEntries(() => setPayer(p))} />
        ) : !days.length ? (
          <div className="rounded-lg border border-dashed border-hairline bg-white py-12 text-center">
            <p className="text-[14px] text-ink-mute">{rows.length ? "Nothing matches these filters." : `No expenses in ${periodLabel(period)}.`}</p>
            <button onClick={() => setDialog({ mode: "add" })} className="mt-3 text-[13.5px] font-semibold text-primary">+ Add an expense</button>
          </div>
        ) : (
          <div className="space-y-3">
            {days.map(([date, list]) => {
              const allOn = list.every((r) => sel.has(r.id));
              return (
                <section key={date} className="bg-surface rounded-lg border border-hairline overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-2 bg-canvas-soft border-b border-hairline">
                    <input type="checkbox" checked={allOn} onChange={(e) => toggle(list.map((r) => r.id), e.target.checked)} aria-label={`Select all on ${dayName(date)}`} className="w-4 h-4 accent-[var(--color-primary,#0e7490)]" />
                    <p className="flex-1 text-[13.5px] font-bold text-ink-secondary">
                      {dayName(date)}
                      {date === today && <span className="ml-2 text-[11px] font-semibold text-primary">TODAY</span>}
                    </p>
                    <p className="text-[13.5px] font-bold text-ink-secondary">
                      {rupees(dayTotals[date])} <span className="text-[11.5px] font-normal text-ink-mute">· {list.length}</span>
                    </p>
                  </div>
                  <ul className="divide-y divide-hairline">
                    {list.map((r) => (
                      <Row
                        key={r.id}
                        r={r}
                        on={sel.has(r.id)}
                        onToggle={(v) => toggle([r.id], v)}
                        onCategory={(c) => setCategory([r.id], c)}
                        onEdit={() => setDialog({ mode: "edit", row: r })}
                        onCopy={() => setDialog({ mode: "add", row: { ...r, exp_date: today } })}
                        onDelete={() => remove(r)}
                        onPerson={() => setPerson(r.paid_to)}
                        onTruck={() => setTruck(r.vehicle_no)}
                      />
                    ))}
                  </ul>
                </section>
              );
            })}
            {shown.length > limit && (
              <button onClick={() => setLimit(limit + PAGE)} className="w-full h-11 rounded-lg border border-hairline bg-white text-[13.5px] font-semibold text-primary hover:bg-primary-container">
                Show more · {shown.length - limit} left
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bulk bar */}
      {sel.size > 0 && (
        <div className="fixed z-40 left-1/2 -translate-x-1/2 bottom-20 md:bottom-6 w-[calc(100%-24px)] max-w-2xl flex flex-wrap items-center gap-2 rounded-lg bg-[#0f2a35] text-white px-4 py-2.5 shadow-2xl">
          <span className="text-[13.5px] font-semibold">
            {sel.size} selected · {rupees(sum(selRows))}
          </span>
          <span className="flex-1" />
          <Tags className="w-4 h-4 text-white/70" />
          <Select size="sm" className="w-48 text-ink-secondary" value={bulkCat} onChange={setBulkCat} placeholder="Set category…" options={CATEGORY_KEYS.map((c) => ({ value: c, label: c }))} />
          <button disabled={!bulkCat} onClick={() => setCategory([...sel], bulkCat)} className="h-8 px-3 rounded-md bg-primary hover:bg-primary-press text-[13px] font-semibold disabled:opacity-50">
            Apply
          </button>
          <button onClick={() => setSel(new Set())} className="h-8 px-2 text-[13px] text-white/80 hover:text-white">Cancel</button>
        </div>
      )}

      {/* Phone: floating add button */}
      {!sel.size && (
        <button
          onClick={() => setDialog({ mode: "add" })}
          aria-label="Add expense"
          className="md:hidden fixed z-40 right-4 bottom-20 w-14 h-14 rounded-[999px] bg-primary text-white shadow-xl flex items-center justify-center"
        >
          <Plus className="w-6 h-6" strokeWidth={2.6} />
        </button>
      )}

      {dialog && (
        <Modal title={dialog.mode === "edit" ? "Edit expense" : dialog.row ? "Copy expense" : "Add expense"} onClose={() => setDialog(null)} wide>
          <ExpenseForm
            key={dialog.row?.id || "new"}
            edit={dialog.mode === "edit"}
            initial={dialog.row}
            vehicles={vehicles}
            payers={data?.payers || []}
            payees={data?.payees || []}
            defaultDate={today >= period.from && today <= period.to ? today : period.to < today ? period.to : period.from}
            onSave={async (v) => {
              if (dialog.mode === "edit") {
                await api.expenses.update(dialog.row.id, v);
                setDialog(null);
              } else await api.expenses.create(v);
              load();
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function Kpi({ label, value, children, tone, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`text-left min-w-0 bg-surface rounded-lg border p-4 ${tone === "warn" ? "border-[#f5c26b] bg-[#fffaf0]" : "border-hairline"} ${onClick ? "hover:border-primary transition-colors" : ""}`}
    >
      <p className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-mute flex items-center gap-1">
        {tone === "warn" && <AlertCircle className="w-3.5 h-3.5 text-[#b45309]" />}
        {label}
      </p>
      <p className="text-[22px] md:text-[26px] font-bold text-ink-secondary leading-tight mt-1 truncate">{value}</p>
      <div className="text-[12px] text-ink-mute mt-0.5 min-w-0">{children}</div>
    </Tag>
  );
}

function Row({ r, on, onToggle, onCategory, onEdit, onCopy, onDelete, onPerson, onTruck }) {
  const icon = "w-8 h-8 flex items-center justify-center rounded-md text-ink-mute hover:bg-white";
  return (
    <li className={`group grid grid-cols-[20px_1fr_auto] md:grid-cols-[20px_100px_minmax(0,1.3fr)_minmax(0,1.4fr)_200px_120px_100px] gap-x-3 gap-y-1.5 items-center px-4 py-2 ${on ? "bg-primary-container/60" : "hover:bg-surface-container-low"}`}>
      <input type="checkbox" checked={on} onChange={(e) => onToggle(e.target.checked)} aria-label="Select" className="w-4 h-4" />
      <span className="hidden md:block text-[12.5px] text-ink-mute truncate">{r.paid_by}</span>
      <span className="min-w-0">
        <button onClick={onPerson} title="Show everything paid to this person" className="block max-w-full text-left text-[14px] font-semibold text-ink-secondary truncate hover:text-primary">
          {r.paid_to}
        </button>
        <span className="md:hidden flex items-center gap-1.5 text-[12px] text-ink-mute min-w-0">
          {r.vehicle_no && <Plate no={r.vehicle_no} small />}
          <span className="truncate">{[r.reason, r.paid_by].filter(Boolean).join(" · ")}</span>
        </span>
      </span>
      <span className="hidden md:flex items-center gap-2 min-w-0 text-[13px] text-[#46525c]">
        {r.vehicle_no && (
          <button onClick={onTruck} title="Show this truck only">
            <Plate no={r.vehicle_no} small />
          </button>
        )}
        <span className="truncate">{r.reason || ""}</span>
      </span>
      <span className="col-start-2 col-span-1 md:col-start-auto md:col-span-1 flex items-center gap-2 min-w-0">
        <Select size="sm" className={`w-full max-w-[200px] ${r.category === "Other" ? "ring-1 ring-[#f5c26b] rounded-md" : ""}`} value={r.category} onChange={(c) => c !== r.category && onCategory(c)} options={CATEGORY_KEYS.map((c) => ({ value: c, label: c }))} />
      </span>
      <span className="row-start-1 col-start-3 md:row-start-auto md:col-start-auto text-[14.5px] font-bold text-ink-secondary text-right whitespace-nowrap">{rupees(r.amount)}</span>
      <span className="col-start-3 md:col-start-auto flex justify-end gap-0.5 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100">
        <button onClick={onCopy} aria-label="Copy to today" title="Copy to today" className={`${icon} hover:text-primary`}>
          <Copy className="w-4 h-4" />
        </button>
        <button onClick={onEdit} aria-label="Edit" title="Edit" className={`${icon} hover:text-primary`}>
          <Pencil className="w-4 h-4" />
        </button>
        <button onClick={onDelete} aria-label="Delete" title="Delete" className={`${icon} hover:text-error`}>
          <Trash2 className="w-4 h-4" />
        </button>
      </span>
    </li>
  );
}

// Truck / person totals table.
function GroupTable({ groups, first, name, onPick }) {
  const [n, setN] = useState(60);
  if (!groups.length) return <p className="rounded-lg border border-dashed border-hairline bg-white py-12 text-center text-[14px] text-ink-mute">Nothing to show.</p>;
  const all = sum(groups.map((g) => ({ amount: g.total })));
  return (
    <div className="bg-surface rounded-lg border border-hairline overflow-hidden">
      <div className="hidden md:grid grid-cols-[minmax(0,1.4fr)_120px_70px_minmax(0,1.6fr)_90px] gap-4 px-4 py-2 bg-canvas-soft border-b border-hairline text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-mute">
        <span>{first}</span>
        <span className="text-right">Total</span>
        <span className="text-right">Entries</span>
        <span>Spent on</span>
        <span className="text-right">Last paid</span>
      </div>
      <ul className="divide-y divide-hairline">
        {groups.slice(0, n).map((g) => {
          const top = Object.entries(g.cats).sort((a, b) => b[1] - a[1])[0][0];
          return (
            <li key={g.key}>
              <button onClick={() => onPick(g)} className="w-full text-left grid grid-cols-[1fr_auto] md:grid-cols-[minmax(0,1.4fr)_120px_70px_minmax(0,1.6fr)_90px] gap-x-4 gap-y-1.5 items-center px-4 py-2.5 hover:bg-surface-container-low">
                <span className="min-w-0 flex items-center">{name(g)}</span>
                <span className="text-right">
                  <span className="block text-[14.5px] font-bold text-ink-secondary">{rupees(g.total)}</span>
                  <span className="block text-[10.5px] text-ink-mute">{((g.total / all) * 100).toFixed(1)}%</span>
                </span>
                <span className="hidden md:block text-right text-[13px] text-ink-secondary">{g.count}</span>
                <span className="col-span-2 md:col-span-1 min-w-0 flex items-center gap-2">
                  <span className="flex-1 min-w-0"><SplitBar cats={g.cats} total={g.total} /></span>
                  <span className="text-[11.5px] text-ink-mute whitespace-nowrap">mostly {top}</span>
                </span>
                <span className="hidden md:block text-right text-[12.5px] text-ink-mute">{short(g.last)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {groups.length > n && (
        <button onClick={() => setN(n + 100)} className="w-full h-10 border-t border-hairline text-[13px] font-semibold text-primary hover:bg-primary-container">
          Show more · {groups.length - n} left
        </button>
      )}
    </div>
  );
}

function Breakdowns({ rows, payers, onCat, onPayer }) {
  const cats = groupSum(rows, (r) => r.category);
  const total = sum(rows);
  if (!rows.length) return <p className="rounded-lg border border-dashed border-hairline bg-white py-12 text-center text-[14px] text-ink-mute">Nothing to show.</p>;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <section className="bg-surface rounded-lg border border-hairline p-5 lg:col-span-2">
        <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-ink-mute mb-3">Where the money went</p>
        <div className="flex h-4 rounded-[999px] overflow-hidden mb-4">
          {cats.map((c) => (
            <span key={c.key} title={`${c.key}: ${rupees(c.total)}`} style={{ width: `${(c.total / total) * 100}%`, backgroundColor: catColor(c.key) }} />
          ))}
        </div>
        <div className="space-y-1.5">
          {cats.map((c) => (
            <button key={c.key} onClick={() => onCat(c.key)} className="w-full grid grid-cols-[160px_1fr_110px] sm:grid-cols-[190px_1fr_120px] items-center gap-3 text-left rounded-md px-1.5 py-1.5 hover:bg-surface-container-low">
              <span className="min-w-0">
                <CatChip cat={c.key} />
                <span className="block pl-3.5 text-[11px] text-ink-mute">{c.count} entries</span>
              </span>
              <span className="h-2.5 rounded-[999px] bg-surface-container overflow-hidden">
                <span className="block h-full rounded-[999px]" style={{ width: `${(c.total / cats[0].total) * 100}%`, backgroundColor: catColor(c.key) }} />
              </span>
              <span className="text-[13px] font-semibold text-ink-secondary text-right">
                {rupees(c.total)}
                <span className="block text-[10.5px] font-normal text-ink-mute">{((c.total / total) * 100).toFixed(1)}%</span>
              </span>
            </button>
          ))}
        </div>
      </section>
      <section className="bg-surface rounded-lg border border-hairline p-5">
        <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-ink-mute mb-3">Who paid</p>
        <div className="space-y-1">
          {payers.map((p) => (
            <button key={p.key} onClick={() => onPayer(p.key)} className="w-full rounded-md px-2 py-1.5 hover:bg-surface-container-low text-left">
              <span className="flex items-center justify-between text-[13px]">
                <span className="text-ink-secondary font-semibold truncate">{p.key}</span>
                <span className="text-ink-secondary font-bold">{lakh(p.total)}</span>
              </span>
              <span className="mt-1 block"><SplitBar cats={p.cats} total={p.total} /></span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

const LAST_PAYER = "expenses_last_paid_by";
const QUICK = [500, 1000, 2000, 5000, 10000];

// Add / edit / copy one expense. When adding, the dialog stays open for the next row.
function ExpenseForm({ edit, initial, vehicles, payers, payees, defaultDate, onSave }) {
  const blank = () => ({
    exp_date: defaultDate,
    paid_by: (typeof window !== "undefined" && localStorage.getItem(LAST_PAYER)) || payers[0] || "",
    paid_to: "",
    reason: "",
    amount: "",
    category: "Other",
    vehicle_id: "",
  });
  const [f, setF] = useState(() =>
    initial
      ? { ...initial, amount: String(initial.amount), reason: initial.reason || "", vehicle_id: initial.vehicle_id ? String(initial.vehicle_id) : "" }
      : blank()
  );
  // Category and vehicle follow what's typed until the user picks one themselves.
  const [picked, setPicked] = useState({ category: !!initial, vehicle_id: !!initial });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState([]);
  const firstRef = useRef(null);
  const amountRef = useRef(null);
  const known = useMemo(() => new Map(payees.map((p) => [norm(p.name), p])), [payees]);

  useEffect(() => {
    (initial ? amountRef : firstRef).current?.focus();
  }, []);

  function set(k, v) {
    setF((x) => {
      const next = { ...x, [k]: v };
      if (k === "paid_to" || k === "reason") {
        const past = known.get(norm(next.paid_to).trim());
        if (!picked.category) {
          const g = guessCategory(next.paid_to, next.reason);
          // A known person with no reason typed → what they were paid for last time.
          next.category = past && (!next.reason || g === "Other") ? past.category : g;
        }
        if (!picked.vehicle_id) {
          const v = guessVehicle(`${next.paid_to} ${next.reason}`, vehicles)?.id || (!next.reason && past?.vehicle_id);
          next.vehicle_id = v ? String(v) : "";
        }
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
      if (!edit) {
        setSaved((s) => [{ to: f.paid_to, amount: Number(f.amount) }, ...s].slice(0, 5));
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
  const chip = "h-7 px-2.5 rounded-[999px] border text-[12px] font-semibold whitespace-nowrap";
  return (
    <form onSubmit={submit} className="space-y-4">
      {saved.length > 0 && (
        <div className="rounded-md bg-[#ecfdf3] border border-[#b7ebc9] px-3 py-2 text-[12.5px] text-[#166534]">
          <p className="font-semibold flex items-center gap-1">
            <Check className="w-4 h-4" /> Saved {saved.length} {saved.length === 1 ? "entry" : "entries"} · {rupees(sum(saved))}
          </p>
          <p className="mt-0.5 truncate">{saved.map((s) => `${s.to} ${rupees(s.amount)}`).join(" · ")}</p>
        </div>
      )}

      {/* Amount first: it's the one thing every entry has */}
      <label className="block">
        <span className={label}>Amount (₹)</span>
        <input
          ref={amountRef}
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          className="input h-12 text-[22px] font-bold"
          value={f.amount}
          onChange={(e) => set("amount", e.target.value)}
          placeholder="0"
          required
        />
        <span className="flex flex-wrap gap-1.5 mt-2">
          {QUICK.map((n) => (
            <button key={n} type="button" onClick={() => set("amount", String(n))} className={`${chip} ${Number(f.amount) === n ? "border-primary bg-primary-container text-primary" : "border-hairline text-ink-mute hover:border-primary"}`}>
              {rupees(n)}
            </button>
          ))}
        </span>
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="sm:col-span-2">
          <span className={label}>Paid to</span>
          <input ref={firstRef} className="input" list="exp-payees" value={f.paid_to} onChange={(e) => set("paid_to", e.target.value)} placeholder="Person, shop or pump" required />
          {!f.paid_to && payees.length > 0 && (
            <span className="flex flex-wrap gap-1.5 mt-2">
              {payees.slice(0, 8).map((p) => (
                <button key={p.name} type="button" onClick={() => set("paid_to", p.name)} className={`${chip} border-hairline text-ink-secondary hover:border-primary`}>
                  {p.name}
                </button>
              ))}
            </span>
          )}
        </label>
        <label className="sm:col-span-2">
          <span className={label}>Reason</span>
          <input className="input" value={f.reason} onChange={(e) => set("reason", e.target.value)} placeholder="e.g. 1238 diesel, mathadi, advance" />
        </label>
        <label>
          <span className={label}>Category {!picked.category && f.paid_to && <span className="font-normal text-primary">· auto</span>}</span>
          <Select
            value={f.category}
            onChange={(v) => {
              setPicked((p) => ({ ...p, category: true }));
              setF((x) => ({ ...x, category: v }));
            }}
            options={CATEGORY_KEYS.map((c) => ({ value: c, label: c }))}
          />
        </label>
        <label>
          <span className={label}>Truck {!picked.vehicle_id && f.vehicle_id && <span className="font-normal text-primary">· auto</span>}</span>
          <Select
            value={String(f.vehicle_id || "")}
            onChange={(v) => {
              setPicked((p) => ({ ...p, vehicle_id: true }));
              setF((x) => ({ ...x, vehicle_id: v }));
            }}
            options={[{ value: "", label: "No truck" }, ...vehicles.map((v) => ({ value: String(v.id), label: v.vehicle_no }))]}
          />
        </label>
        <label>
          <span className={label}>Date</span>
          <input type="date" className="input" value={f.exp_date} onChange={(e) => set("exp_date", e.target.value)} required />
        </label>
        <label>
          <span className={label}>Paid by</span>
          <input className="input" list="exp-payers" value={f.paid_by} onChange={(e) => set("paid_by", e.target.value)} placeholder="Vinod Sir" required />
          <span className="flex flex-wrap gap-1.5 mt-2">
            {payers.slice(0, 4).map((p) => (
              <button key={p} type="button" onClick={() => set("paid_by", p)} className={`${chip} ${f.paid_by === p ? "border-primary bg-primary-container text-primary" : "border-hairline text-ink-mute hover:border-primary"}`}>
                {p}
              </button>
            ))}
          </span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        {error && <p className="text-error text-sm">{error}</p>}
        <span className="flex-1 text-[11.5px] text-ink-mute">{edit ? "" : "Press Enter to save — the form stays open for the next one."}</span>
        <button disabled={busy} className="h-11 px-6 rounded-md bg-primary hover:bg-primary-press text-white text-[14px] font-semibold shadow-sm disabled:opacity-60">
          {busy ? "Saving…" : edit ? "Save changes" : `Save${f.amount ? ` ${rupees(f.amount)}` : ""}`}
        </button>
      </div>
      <datalist id="exp-payers">
        {payers.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <datalist id="exp-payees">
        {payees.map((p) => (
          <option key={p.name} value={p.name} />
        ))}
      </datalist>
    </form>
  );
}
