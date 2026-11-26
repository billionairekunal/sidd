"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Search, X, RefreshCw, History, Trash2, ChevronRight, Phone, CalendarClock, Truck } from "lucide-react";
import { api } from "../lib/api";
import OfficeHeader from "../components/OfficeHeader";
import Select from "../components/Select";
import {
  PAPERS, CATEGORIES, BUCKETS, RED_DAYS, paperByKey, paperRows, daysLeft, bucketOf, todayIST, addMonths, fmtDate, daysText,
} from "../lib/papers";

const STATUSES = ["Available", "Loading", "In Transit", "Maintenance", "Idle"];
const CAT_LABEL = { line: "Line", local: "Local" };

// Colours per alert bucket — shared look for pills, cards and date cells.
export const BUCKET_STYLE = {
  expired: { pill: "bg-[#fdecec] text-[#b91c1c] border-[#f5c2c2]", card: "border-[#f5c2c2] bg-[#fdf3f3]", text: "text-[#b91c1c]", dot: "bg-[#dc2626]" },
  urgent: { pill: "bg-[#fff0e6] text-[#c2410c] border-[#fbd0b1]", card: "border-[#fbd0b1] bg-[#fff6ef]", text: "text-[#c2410c]", dot: "bg-[#ea580c]" },
  d15: { pill: "bg-[#fff7df] text-[#a16207] border-[#f3df9c]", card: "border-[#f3df9c] bg-[#fffbec]", text: "text-[#a16207]", dot: "bg-[#eab308]" },
  d30: { pill: "bg-[#eaf1ff] text-[#1d4ed8] border-[#c7d7fb]", card: "border-[#c7d7fb] bg-[#f3f7ff]", text: "text-[#1d4ed8]", dot: "bg-[#3b82f6]" },
  ok: { pill: "bg-[#e8f7ee] text-[#15803d] border-[#bfe5cd]", card: "border-[#bfe5cd] bg-[#f1fbf5]", text: "text-[#15803d]", dot: "bg-[#22c55e]" },
  none: { pill: "bg-surface-container text-ink-mute border-hairline", card: "", text: "text-ink-mute", dot: "bg-[#c5d0d8]" },
};
const isRed = (days) => days != null && days <= RED_DAYS;
const RED_ROW = "bg-[#fdeeee] hover:bg-[#fbe4e4] shadow-[inset_3px_0_0_#dc2626]";
const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export function Plate({ no, small }) {
  return (
    <span
      className={`inline-block font-bold tracking-wide rounded-[3px] border border-[#d9c24a] bg-[#fff3b0] text-[#1f2b37] whitespace-nowrap ${
        small ? "px-1.5 py-[1px] text-[12px]" : "px-2 py-0.5 text-[13.5px]"
      }`}
    >
      {no}
    </span>
  );
}

export function DaysPill({ days }) {
  const s = BUCKET_STYLE[bucketOf(days)];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-[999px] border px-2 py-0.5 text-[12px] font-semibold whitespace-nowrap ${s.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-[999px] ${s.dot}`} />
      {daysText(days)}
    </span>
  );
}

export default function Fleet() {
  const params = useSearchParams();
  const [vehicles, setVehicles] = useState(null);
  const [error, setError] = useState("");
  const [cat, setCat] = useState(params.get("cat") || "all");
  const [bucket, setBucket] = useState(params.get("bucket") || "all");
  const [view, setView] = useState(params.get("view") || "renewals");
  const [paper, setPaper] = useState("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState(null);
  const [renewing, setRenewing] = useState(null); // { vehicle, paper }
  const [adding, setAdding] = useState(false);
  const today = todayIST();

  const reload = () => api.vehicles.list().then(setVehicles).catch((err) => setError(err.message));
  useEffect(() => {
    reload();
  }, []);

  const all = vehicles || [];
  const catCount = (c) => (c === "all" ? all.length : all.filter((v) => (v.category || "line") === c).length);
  const shown = useMemo(
    () =>
      all
        .filter((v) => cat === "all" || (v.category || "line") === cat)
        .filter((v) => !q || norm([v.vehicle_no, v.driver_name, v.owner_name, v.vehicle_type].join(" ")).includes(norm(q))),
    [all, cat, q]
  );

  const rowsAll = useMemo(
    () => paperRows(shown, today).filter((r) => paper === "all" || r.paper.key === paper),
    [shown, today, paper]
  );
  const counts = Object.fromEntries(BUCKETS.map((b) => [b.key, rowsAll.filter((r) => r.bucket === b.key).length]));
  const rows = bucket === "all" ? rowsAll : rowsAll.filter((r) => r.bucket === bucket);

  // Vehicles view: each truck with its most urgent paper; trucks with no dates go last.
  const fleetRows = useMemo(() => {
    const list = shown.map((v) => {
      const ds = PAPERS.map((p) => daysLeft(v[p.key], today)).filter((d) => d != null);
      return { v, worst: ds.length ? Math.min(...ds) : null, buckets: new Set(ds.map(bucketOf)) };
    });
    return list
      .filter((r) => bucket === "all" || r.buckets.has(bucket))
      .sort((a, b) => (a.worst ?? 1e9) - (b.worst ?? 1e9) || a.v.vehicle_no.localeCompare(b.v.vehicle_no));
  }, [shown, today, bucket]);
  const noDates = shown.filter((v) => !PAPERS.some((p) => v[p.key])).length;

  const open = all.find((v) => v.id === openId);

  return (
    <div className="flex-1 flex flex-col">
      <OfficeHeader />
      <div className="p-4 md:px-xxl md:py-xl space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[22px] md:text-[26px] font-bold text-ink-secondary tracking-tight">Fleet &amp; Renewals</h1>
            <p className="text-[13.5px] text-ink-mute mt-0.5">
              Every truck, its papers and when they expire — checked against today, <b className="text-ink-secondary">{fmtDate(today)}</b>.
            </p>
          </div>
          <button
            onClick={() => setAdding(true)}
            className="h-10 px-4 inline-flex items-center gap-2 rounded-md bg-primary hover:bg-primary-press text-white text-[14px] font-semibold shadow-sm"
          >
            <Plus className="w-4 h-4" strokeWidth={2.4} /> Add Vehicle
          </button>
        </header>

        {error && <p className="text-error text-sm">{error}</p>}

        {/* Partition: line (long route) vs local trucks */}
        <nav className="flex gap-1 border-b border-hairline overflow-x-auto no-scrollbar">
          {[{ key: "all", label: "All Vehicles" }, ...CATEGORIES].map((c) => (
            <button
              key={c.key}
              onClick={() => setCat(c.key)}
              className={`h-11 px-3 md:px-4 -mb-px border-b-2 text-[14px] whitespace-nowrap flex items-center gap-2 ${
                cat === c.key ? "border-primary text-ink-secondary font-semibold" : "border-transparent text-ink-mute hover:text-ink-secondary"
              }`}
            >
              {c.label}
              <span className={`text-[11.5px] rounded-[999px] px-1.5 py-px font-semibold ${cat === c.key ? "bg-primary-container text-primary-deep" : "bg-surface-container text-ink-mute"}`}>
                {vehicles ? catCount(c.key) : "…"}
              </span>
            </button>
          ))}
        </nav>

        {/* Alert buckets — click to filter */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {BUCKETS.filter((b) => b.key !== "ok").map((b) => {
            const s = BUCKET_STYLE[b.key];
            const active = bucket === b.key;
            return (
              <button
                key={b.key}
                onClick={() => setBucket(active ? "all" : b.key)}
                className={`text-left rounded-lg border p-3.5 md:p-4 transition ${s.card} ${active ? "ring-2 ring-offset-1 ring-[#1f2b37]/70" : "hover:shadow-sm"}`}
              >
                <div className="flex items-center justify-between">
                  <p className={`text-[11px] font-bold uppercase tracking-[0.08em] ${s.text}`}>{b.label}</p>
                  <span className={`w-2 h-2 rounded-[999px] ${s.dot}`} />
                </div>
                <p className={`text-[28px] leading-tight font-bold ${s.text}`}>{vehicles ? counts[b.key] : "—"}</p>
                <p className="text-[12px] text-ink-mute">{b.hint} · papers</p>
              </button>
            );
          })}
        </section>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex rounded-md border border-hairline bg-white p-0.5">
            {[["renewals", "Renewals (by date)"], ["vehicles", "Vehicles"]].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setView(k)}
                className={`h-8 px-3 rounded-[5px] text-[13px] font-semibold ${view === k ? "bg-primary text-white" : "text-ink-mute hover:text-ink-secondary"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 h-9 px-2.5 rounded-md bg-white border border-hairline focus-within:border-primary flex-1 min-w-[180px] max-w-sm">
            <Search className="w-4 h-4 text-ink-mute" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Vehicle no., driver or owner"
              className="flex-1 min-w-0 bg-transparent text-[13.5px] focus:outline-none"
            />
            {q && (
              <button onClick={() => setQ("")} aria-label="Clear search">
                <X className="w-4 h-4 text-ink-mute" />
              </button>
            )}
          </label>
          {view === "renewals" && (
            <Select
              size="sm"
              className="w-48"
              value={paper}
              onChange={setPaper}
              options={[{ value: "all", label: "All papers" }, ...PAPERS.map((p) => ({ value: p.key, label: p.label }))]}
            />
          )}
          {bucket !== "all" && (
            <button onClick={() => setBucket("all")} className="h-8 px-2.5 inline-flex items-center gap-1 rounded-[999px] bg-[#1f2b37] text-white text-[12px] font-semibold">
              {BUCKETS.find((b) => b.key === bucket)?.label} <X className="w-3.5 h-3.5" />
            </button>
          )}
          <span className="ml-auto text-[12px] text-ink-mute flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[#fdeeee] shadow-[inset_3px_0_0_#dc2626]" /> Red row = expired or due within {RED_DAYS} days
          </span>
        </div>

        {noDates > 0 && (
          <p className="text-[13px] rounded-md border border-hairline bg-white px-3 py-2 text-ink-mute">
            <b className="text-ink-secondary">{noDates} vehicle{noDates === 1 ? "" : "s"}</b> have no paper dates yet, so they
            can't be tracked. Open them in <button className="text-primary font-semibold" onClick={() => setView("vehicles")}>Vehicles</button> and add the dates.
          </p>
        )}

        {!vehicles ? (
          <p className="text-ink-mute text-sm py-10 text-center">Loading fleet…</p>
        ) : view === "renewals" ? (
          <RenewalsTable rows={rows} onOpen={setOpenId} onRenew={(vehicle, p) => setRenewing({ vehicle, paper: p })} />
        ) : (
          <VehiclesTable rows={fleetRows} today={today} onOpen={setOpenId} />
        )}
      </div>

      {open && (
        <VehicleDrawer
          vehicle={open}
          today={today}
          onClose={() => setOpenId(null)}
          onRenew={(p) => setRenewing({ vehicle: open, paper: p })}
          onChanged={reload}
        />
      )}
      {renewing && (
        <RenewDialog
          {...renewing}
          today={today}
          onClose={() => setRenewing(null)}
          onDone={() => {
            setRenewing(null);
            reload();
          }}
        />
      )}
      {adding && (
        <Modal title="Add Vehicle" onClose={() => setAdding(false)} wide>
          <VehicleForm
            initial={{ category: cat === "local" ? "local" : "line", status: "Available" }}
            submitLabel="Add Vehicle"
            onSubmit={async (data) => {
              const v = await api.vehicles.create(data);
              setAdding(false);
              await reload();
              setOpenId(v.id);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function RenewalsTable({ rows, onOpen, onRenew }) {
  if (!rows.length) return <Empty text="No papers in this list. 🎉" />;
  return (
    <>
      {/* Phones: cards */}
      <ul className="md:hidden space-y-2">
        {rows.map((r) => (
          <li key={r.id} className={`rounded-lg border border-hairline p-3 ${isRed(r.days) ? RED_ROW : "bg-white"}`}>
            <div className="flex items-center justify-between gap-2">
              <button onClick={() => onOpen(r.vehicle.id)} className="flex items-center gap-2 min-w-0">
                <Plate no={r.vehicle.vehicle_no} small />
                <span className="text-[12px] text-ink-mute">{CAT_LABEL[r.vehicle.category] || "Line"}</span>
              </button>
              <DaysPill days={r.days} />
            </div>
            <div className="flex items-center justify-between gap-2 mt-2">
              <div>
                <p className="text-[14px] font-semibold text-ink-secondary">{r.paper.label}</p>
                <p className="text-[12.5px] text-ink-mute">Expiry {fmtDate(r.date)}</p>
              </div>
              <RenewButton onClick={() => onRenew(r.vehicle, r.paper)} />
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden md:block bg-surface rounded-lg border border-hairline overflow-hidden">
        <table className="w-full text-left border-collapse text-[13.5px]">
          <thead>
            <tr className="text-[11px] text-ink-mute uppercase tracking-[0.08em] border-b border-hairline bg-canvas-soft">
              <th className="py-2.5 px-4 font-semibold">Vehicle</th>
              <th className="py-2.5 px-4 font-semibold">Paper</th>
              <th className="py-2.5 px-4 font-semibold">Expiry Date</th>
              <th className="py-2.5 px-4 font-semibold">Status</th>
              <th className="py-2.5 px-4 font-semibold">Driver</th>
              <th className="py-2.5 px-4 font-semibold">Owner</th>
              <th className="py-2.5 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={`border-b border-hairline last:border-b-0 ${isRed(r.days) ? RED_ROW : "hover:bg-surface-container-low"}`}>
                <td className="py-2.5 px-4">
                  <button onClick={() => onOpen(r.vehicle.id)} className="flex items-center gap-2 group">
                    <Plate no={r.vehicle.vehicle_no} small />
                    <span className="text-[12px] text-ink-mute group-hover:text-primary">
                      {CAT_LABEL[r.vehicle.category] || "Line"}
                      {r.vehicle.vehicle_type ? ` · ${r.vehicle.vehicle_type}` : ""}
                    </span>
                  </button>
                </td>
                <td className={`py-2.5 px-4 font-semibold ${isRed(r.days) ? "text-[#991b1b]" : "text-ink-secondary"}`}>{r.paper.label}</td>
                <td className={`py-2.5 px-4 whitespace-nowrap ${isRed(r.days) ? "text-[#991b1b] font-semibold" : "text-[#46525c]"}`}>{fmtDate(r.date)}</td>
                <td className="py-2.5 px-4">
                  <DaysPill days={r.days} />
                </td>
                <td className="py-2.5 px-4 text-[#46525c]">{r.vehicle.driver_name || "—"}</td>
                <td className="py-2.5 px-4 text-[#46525c]">{r.vehicle.owner_name || "—"}</td>
                <td className="py-2.5 px-4 text-right">
                  <RenewButton onClick={() => onRenew(r.vehicle, r.paper)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function VehiclesTable({ rows, today, onOpen }) {
  if (!rows.length) return <Empty text="No vehicles match." />;
  return (
    <div className="bg-surface rounded-lg border border-hairline overflow-x-auto">
      <table className="w-full text-left border-collapse text-[13px]">
        <thead>
          <tr className="text-[11px] text-ink-mute uppercase tracking-[0.08em] border-b border-hairline bg-canvas-soft">
            <th className="py-2.5 px-3 font-semibold">Vehicle</th>
            <th className="py-2.5 px-3 font-semibold">Driver / Owner</th>
            {PAPERS.map((p) => (
              <th key={p.key} className="py-2.5 px-3 font-semibold whitespace-nowrap">{p.short}</th>
            ))}
            <th className="py-2.5 px-3 font-semibold">Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ v, worst }) => (
            <tr
              key={v.id}
              onClick={() => onOpen(v.id)}
              className={`border-b border-hairline last:border-b-0 cursor-pointer ${isRed(worst) ? RED_ROW : "hover:bg-surface-container-low"}`}
            >
              <td className="py-2.5 px-3">
                <Plate no={v.vehicle_no} small />
                <p className="text-[11.5px] text-ink-mute mt-1 whitespace-nowrap">
                  {[CAT_LABEL[v.category] || "Line", v.vehicle_type, v.fuel_type].filter(Boolean).join(" · ")}
                </p>
              </td>
              <td className="py-2.5 px-3">
                <p className="text-ink-secondary font-medium whitespace-nowrap">{v.driver_name || "—"}</p>
                <p className="text-[11.5px] text-ink-mute">{v.owner_name || "—"}</p>
              </td>
              {PAPERS.map((p) => {
                const d = daysLeft(v[p.key], today);
                const s = BUCKET_STYLE[bucketOf(d)];
                return (
                  <td key={p.key} className="py-2.5 px-3 whitespace-nowrap">
                    {d == null ? (
                      <span className="text-ink-mute">—</span>
                    ) : (
                      <span className={`inline-block rounded-md border px-1.5 py-0.5 ${s.pill}`} title={daysText(d)}>
                        <span className="block text-[12px] font-semibold leading-tight">{fmtDate(v[p.key])}</span>
                        <span className="block text-[10.5px] leading-tight opacity-90">{d < 0 ? `${-d}d overdue` : `${d}d left`}</span>
                      </span>
                    )}
                  </td>
                );
              })}
              <td className="py-2.5 px-3 text-[12.5px] text-[#46525c] whitespace-nowrap">{v.status}</td>
              <td className="py-2.5 px-2 text-ink-mute">
                <ChevronRight className="w-4 h-4" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RenewButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md border border-primary/60 bg-white text-primary hover:bg-primary-container text-[12.5px] font-semibold"
    >
      <RefreshCw className="w-3.5 h-3.5" /> Renew
    </button>
  );
}

function Empty({ text }) {
  return <p className="rounded-lg border border-dashed border-hairline bg-white py-12 text-center text-[14px] text-ink-mute">{text}</p>;
}

function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-[#0f2a35]/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative w-full ${wide ? "sm:max-w-2xl" : "sm:max-w-md"} max-h-[92dvh] overflow-y-auto bg-white rounded-t-xl sm:rounded-xl shadow-2xl`}>
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 py-4 border-b border-hairline z-10">
          <h2 className="text-[17px] font-bold text-ink-secondary">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-surface-container">
            <X className="w-5 h-5 text-ink-mute" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function RenewDialog({ vehicle, paper, today, onClose, onDone }) {
  const current = vehicle[paper.key];
  const base = current && current >= today ? current : today; // expired → the new period starts today
  const [months, setMonths] = useState(paper.months);
  const [newUpto, setNewUpto] = useState(addMonths(base, paper.months));
  const [amount, setAmount] = useState("");
  const [refNo, setRefNo] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pick = (m) => {
    setMonths(m);
    setNewUpto(addMonths(base, m));
  };

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.vehicles.renew(vehicle.id, { paper: paper.key, newUpto, amount, refNo, note });
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={`Renew ${paper.label}`} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-md bg-surface-container-low border border-hairline px-3 py-2.5">
          <Plate no={vehicle.vehicle_no} />
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.08em] text-ink-mute font-semibold">Current expiry</p>
            <p className="text-[14px] font-semibold text-ink-secondary">{fmtDate(current)}</p>
            {current && <DaysPill days={daysLeft(current, today)} />}
          </div>
        </div>

        <div>
          <p className="text-[12.5px] font-semibold text-ink-secondary mb-1.5">Renew for</p>
          <div className="flex flex-wrap gap-1.5">
            {[[3, "3 months"], [6, "6 months"], [12, "1 year"], [24, "2 years"], [60, "5 years"]].map(([m, label]) => (
              <button
                type="button"
                key={m}
                onClick={() => pick(m)}
                className={`h-8 px-3 rounded-[999px] border text-[12.5px] font-semibold ${
                  months === m ? "bg-primary border-primary text-white" : "border-hairline text-ink-secondary hover:border-primary"
                }`}
              >
                {label}
                {m === paper.months && <span className="opacity-70 font-normal"> · usual</span>}
              </button>
            ))}
          </div>
          <p className="text-[11.5px] text-ink-mute mt-1.5">
            Counted from {!current ? "today" : current >= today ? "the current expiry" : "today (it has already expired)"}.
          </p>
        </div>

        <Field label="New expiry date *">
          <input type="date" className="input" value={newUpto} onChange={(e) => { setNewUpto(e.target.value); setMonths(null); }} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount paid (₹)">
            <input type="number" min="0" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Optional" />
          </Field>
          <Field label="Policy / receipt no.">
            <input className="input" value={refNo} onChange={(e) => setRefNo(e.target.value)} placeholder="Optional" />
          </Field>
        </div>
        <Field label="Note">
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. agent name, company" />
        </Field>

        {error && <p className="text-error text-sm">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-md border border-hairline text-[14px] font-semibold text-ink-secondary">
            Cancel
          </button>
          <button disabled={busy} className="h-10 px-5 rounded-md bg-primary hover:bg-primary-press text-white text-[14px] font-semibold disabled:opacity-60">
            {busy ? "Saving…" : `Save — valid till ${fmtDate(newUpto)}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[12px] font-semibold text-ink-secondary mb-1">{label}</span>
      {children}
    </label>
  );
}

const FORM_FIELDS = ["vehicle_no", "category", "vehicle_type", "fuel_type", "status", "driver_name", "driver_phone", "owner_name",
  "registration_date", "engine_no", "chassis_no", ...PAPERS.map((p) => p.key)];

function VehicleForm({ initial, submitLabel, onSubmit }) {
  const [f, setF] = useState(() => Object.fromEntries(FORM_FIELDS.map((k) => [k, initial[k] ?? ""])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const text = (k, label, props = {}) => (
    <Field label={label}>
      <input className="input" value={f[k]} onChange={set(k)} {...props} />
    </Field>
  );

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSubmit(f);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Group title="Vehicle">
        {text("vehicle_no", "Vehicle number *", { required: true, placeholder: "MH-14-AB-1234" })}
        <Field label="Fleet">
          <Select value={f.category} onChange={(v) => setF((x) => ({ ...x, category: v }))} options={CATEGORIES.map((c) => ({ value: c.key, label: c.label }))} />
        </Field>
        {text("vehicle_type", "Type", { placeholder: "SXL / MXL / Tempo" })}
        <Field label="Fuel">
          <Select
            value={f.fuel_type}
            onChange={(v) => setF((x) => ({ ...x, fuel_type: v }))}
            options={["Diesel", "CNG", "Petrol", "Electric"].map((v) => ({ value: v, label: v }))}
          />
        </Field>
        <Field label="Status">
          <Select value={f.status} onChange={(v) => setF((x) => ({ ...x, status: v }))} options={STATUSES.map((v) => ({ value: v, label: v }))} />
        </Field>
        {text("owner_name", "Owner")}
      </Group>
      <Group title="Driver">
        {text("driver_name", "Driver name")}
        {text("driver_phone", "Driver phone", { inputMode: "tel" })}
      </Group>
      <Group title="Paper expiry dates">
        {PAPERS.map((p) => (
          <Field key={p.key} label={`${p.label} valid till`}>
            <input type="date" className="input" value={f[p.key]} onChange={set(p.key)} />
          </Field>
        ))}
      </Group>
      <Group title="Registration">
        <Field label="Registration date">
          <input type="date" className="input" value={f.registration_date} onChange={set("registration_date")} />
        </Field>
        {text("engine_no", "Engine number")}
        {text("chassis_no", "Chassis number")}
      </Group>
      {error && <p className="text-error text-sm">{error}</p>}
      <div className="flex justify-end">
        <button disabled={busy} className="h-10 px-5 rounded-md bg-primary hover:bg-primary-press text-white text-[14px] font-semibold disabled:opacity-60">
          {busy ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

function Group({ title, children }) {
  return (
    <fieldset>
      <legend className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-mute mb-2">{title}</legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </fieldset>
  );
}

function VehicleDrawer({ vehicle: v, today, onClose, onRenew, onChanged }) {
  const [tab, setTab] = useState("papers");
  const [history, setHistory] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.vehicles.renewals(v.id).then(setHistory).catch(() => setHistory([]));
  }, [v.id, PAPERS.map((p) => v[p.key]).join()]); // refetch when a renewal changes a date

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function remove() {
    if (!confirm(`Remove ${v.vehicle_no} and its renewal history? This cannot be undone.`)) return;
    try {
      await api.vehicles.remove(v.id);
      onClose();
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-[#0f2a35]/40 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-[600px] bg-canvas-soft shadow-2xl flex flex-col">
        <div className="bg-white border-b border-hairline px-5 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Plate no={v.vehicle_no} />
              <p className="text-[13px] text-ink-mute mt-1.5 flex flex-wrap items-center gap-x-2">
                <span className="font-semibold text-ink-secondary">{CATEGORIES.find((c) => c.key === (v.category || "line"))?.label}</span>
                {[v.vehicle_type, v.fuel_type, v.owner_name && `Owner: ${v.owner_name}`, v.status].filter(Boolean).map((x) => (
                  <span key={x}>· {x}</span>
                ))}
              </p>
              {(v.driver_name || v.driver_phone) && (
                <p className="text-[13px] text-ink-secondary mt-1 flex items-center gap-2">
                  <Truck className="w-3.5 h-3.5 text-ink-mute" /> {v.driver_name || "Driver"}
                  {v.driver_phone && (
                    <a href={`tel:${v.driver_phone}`} className="inline-flex items-center gap-1 text-primary font-semibold">
                      <Phone className="w-3.5 h-3.5" /> {v.driver_phone}
                    </a>
                  )}
                </p>
              )}
            </div>
            <button onClick={onClose} aria-label="Close" className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-surface-container shrink-0">
              <X className="w-5 h-5 text-ink-mute" />
            </button>
          </div>
          <nav className="flex gap-5 mt-3">
            {[["papers", "Papers"], ["history", "Renewal History"], ["details", "Edit Details"]].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`h-10 -mb-px border-b-2 text-[13.5px] ${tab === k ? "border-primary font-semibold text-ink-secondary" : "border-transparent text-ink-mute"}`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {error && <p className="text-error text-sm">{error}</p>}

          {tab === "papers" &&
            [...PAPERS]
              .sort((a, b) => (daysLeft(v[a.key], today) ?? 1e9) - (daysLeft(v[b.key], today) ?? 1e9))
              .map((p) => {
                const d = daysLeft(v[p.key], today);
                return (
                  <div key={p.key} className={`rounded-lg border border-hairline p-3.5 flex items-center justify-between gap-3 ${isRed(d) ? RED_ROW : "bg-white"}`}>
                    <div className="min-w-0">
                      <p className="text-[14.5px] font-semibold text-ink-secondary">{p.label}</p>
                      <p className="text-[12.5px] text-ink-mute">
                        {v[p.key] ? `Valid till ${fmtDate(v[p.key])}` : "No date yet"} · renews every {p.months >= 12 ? `${p.months / 12} yr` : `${p.months} mo`}
                      </p>
                      <div className="mt-1.5">
                        <DaysPill days={d} />
                      </div>
                    </div>
                    <RenewButton onClick={() => onRenew(p)} />
                  </div>
                );
              })}

          {tab === "history" &&
            (!history ? (
              <p className="text-ink-mute text-sm">Loading…</p>
            ) : !history.length ? (
              <Empty text="No renewals recorded yet. Use Renew on a paper to log one." />
            ) : (
              <ol className="relative border-l-2 border-hairline ml-2 space-y-4">
                {history.map((h) => (
                  <li key={h.id} className="ml-4">
                    <span className="absolute -left-[7px] mt-1.5 w-3 h-3 rounded-[999px] bg-primary border-2 border-white" />
                    <div className="rounded-lg border border-hairline bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[14px] font-semibold text-ink-secondary flex items-center gap-1.5">
                          <History className="w-4 h-4 text-primary" /> {paperByKey[h.paper]?.label || h.paper}
                        </p>
                        <p className="text-[11.5px] text-ink-mute">{fmtDate(h.renewed_at.slice(0, 10))}</p>
                      </div>
                      <p className="text-[13px] text-[#46525c] mt-1 flex items-center gap-1.5">
                        <CalendarClock className="w-3.5 h-3.5" /> {fmtDate(h.old_upto)} → <b className="text-ink-secondary">{fmtDate(h.new_upto)}</b>
                      </p>
                      <p className="text-[12px] text-ink-mute mt-1">
                        {[h.amount != null && `₹${Number(h.amount).toLocaleString("en-IN")}`, h.ref_no && `Ref ${h.ref_no}`, h.note, h.renewed_by_name && `by ${h.renewed_by_name}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            ))}

          {tab === "details" && (
            <div className="bg-white rounded-lg border border-hairline p-4 space-y-4">
              <VehicleForm
                key={v.id}
                initial={v}
                submitLabel="Save Changes"
                onSubmit={async (data) => {
                  await api.vehicles.update(v.id, data);
                  onChanged();
                  setTab("papers");
                }}
              />
              <div className="border-t border-hairline pt-4 flex justify-between items-center">
                <p className="text-[12px] text-ink-mute">Sold or scrapped? Remove it from the fleet.</p>
                <button onClick={remove} className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md text-error hover:bg-error-container text-[13px] font-semibold">
                  <Trash2 className="w-4 h-4" /> Remove vehicle
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
