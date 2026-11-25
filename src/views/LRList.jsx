"use client";

import { Truck, IndianRupee, FileText, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "../lib/api";
import StatusBadge from "../components/StatusBadge";
import OfficeHeader from "../components/OfficeHeader";

const STATUS_TABS = ["All", "Draft", "In Transit", "Delivered", "Paid", "Disputed", "Cancelled"];

export default function LRList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ data: [], total: 0, pageSize: 10 });
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const s = searchParams.get("search") || "";
    setSearch(s);
    setPage(1);
  }, [searchParams]);

  useEffect(() => {
    api.lrs
      .list({ status, dateFrom, dateTo, search, page, pageSize: 10 })
      .then(setResult)
      .catch((err) => setError(err.message));
  }, [status, dateFrom, dateTo, search, page]);

  useEffect(() => {
    api.lrs.summary().then(setSummary).catch(() => {});
  }, [result]);

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="flex-1 flex flex-col">
      <OfficeHeader />
      <div className="p-lg md:p-xxl space-y-xl">
      <header>
        <h1 className="text-3xl font-semibold text-ink-secondary">History</h1>
        <p className="text-on-surface-variant text-sm mt-xs">({result.total} total records found)</p>
      </header>

      {error && <p className="text-error">{error}</p>}

      <section className="bg-surface rounded-xl border border-hairline p-lg space-y-md">
        <div className="flex gap-sm overflow-x-auto no-scrollbar -mx-lg px-lg md:mx-0 md:px-0 md:flex-wrap">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setStatus(tab);
                setPage(1);
              }}
              className={`shrink-0 whitespace-nowrap px-md py-xs rounded-full text-sm font-medium border transition-colors ${
                status === tab
                  ? "bg-primary-fixed border-primary text-primary-deep"
                  : "border-hairline text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-md items-center">
          <input
            type="text"
            placeholder="Search by LR, Consignor, or Invoice…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="basis-full md:basis-auto flex-1 md:min-w-[220px] h-11 md:h-auto border border-hairline rounded-lg py-sm px-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="flex-1 min-w-0 md:flex-none border border-hairline rounded-lg py-sm px-md text-sm"
          />
          <span className="text-on-surface-variant text-sm">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="flex-1 min-w-0 md:flex-none border border-hairline rounded-lg py-sm px-md text-sm"
          />
        </div>
      </section>

      <section className="bg-surface rounded-xl border border-hairline overflow-hidden">
        {/* Phones: card list */}
        <ul className="md:hidden divide-y divide-hairline">
          {result.data.length ? (
            result.data.map((lr) => (
              <li key={lr.id}>
                <button
                  onClick={() => router.push(`/lrs/${lr.id}`)}
                  className="w-full text-left px-4 py-3.5 active:bg-surface-container-low"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[14.5px] font-bold text-primary">#{lr.lr_no}</span>
                    <StatusBadge status={lr.status} />
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-1">
                    <span className="text-[13px] text-ink-secondary truncate">{lr.consignor_name}</span>
                    <span className="text-[13.5px] font-bold text-ink-secondary shrink-0">
                      ₹{Number(lr.amount).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-1 text-[12px] text-ink-mute">
                    <span className="truncate">
                      {lr.from_location} → {lr.to_location}
                    </span>
                    <span className="shrink-0">{lr.lr_date}</span>
                  </div>
                </button>
              </li>
            ))
          ) : (
            <li className="px-4 py-8 text-center text-[13.5px] text-ink-mute">No lorry receipts match these filters.</li>
          )}
        </ul>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-canvas-soft border-b border-hairline text-xs text-on-surface-variant uppercase tracking-wider">
                <th className="py-sm px-lg">LR Number</th>
                <th className="py-sm px-lg">Date</th>
                <th className="py-sm px-lg">Consignor</th>
                <th className="py-sm px-lg">Route</th>
                <th className="py-sm px-lg">Vehicle</th>
                <th className="py-sm px-lg">Invoice</th>
                <th className="py-sm px-lg">Amount</th>
                <th className="py-sm px-lg">Status</th>
              </tr>
            </thead>
            <tbody className="text-sm text-ink-secondary divide-y divide-hairline">
              {result.data.length ? (
                result.data.map((lr) => (
                  <tr
                    key={lr.id}
                    className="hover:bg-surface-container-low transition-colors cursor-pointer"
                    onClick={() => router.push(`/lrs/${lr.id}`)}
                  >
                    <td className="py-sm px-lg font-medium text-primary">#{lr.lr_no}</td>
                    <td className="py-sm px-lg text-on-surface-variant">{lr.lr_date}</td>
                    <td className="py-sm px-lg">{lr.consignor_name}</td>
                    <td className="py-sm px-lg text-on-surface-variant">
                      {lr.from_location} → {lr.to_location}
                    </td>
                    <td className="py-sm px-lg text-on-surface-variant">
                      {lr.vehicle?.vehicle_no || "—"}
                    </td>
                    <td className="py-sm px-lg text-on-surface-variant">{lr.invoice_no || "—"}</td>
                    <td className="py-sm px-lg font-medium">
                      ₹{Number(lr.amount).toLocaleString("en-IN")}
                    </td>
                    <td className="py-sm px-lg">
                      <StatusBadge status={lr.status} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-lg px-lg text-center text-on-surface-variant">
                    No lorry receipts match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex justify-between items-center px-lg py-md border-t border-hairline text-sm text-on-surface-variant">
          <span>
            Showing {(page - 1) * result.pageSize + 1}–
            {Math.min(page * result.pageSize, result.total)} of {result.total}
          </span>
          <div className="flex items-center gap-sm">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-md py-xs rounded-lg border border-hairline disabled:opacity-40"
            >
              ‹
            </button>
            <span className="px-md py-xs rounded-lg bg-primary text-on-primary">{page}</span>
            <span>of {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-md py-xs rounded-lg border border-hairline disabled:opacity-40"
            >
              ›
            </button>
          </div>
        </div>
      </section>

      {summary && (
        <section className="grid grid-cols-2 md:grid-cols-4 gap-md">
          <StatCard label="Ongoing Shipments" value={summary.activeTrips} icon={<Truck className="w-5 h-5" strokeWidth={1.8} />} />
          <StatCard
            label="Total Revenue (30d)"
            value={`₹${Number(summary.revenue30d).toLocaleString("en-IN")}`}
            icon={<IndianRupee className="w-5 h-5" strokeWidth={1.8} />}
          />
          <StatCard label="Pending Invoices" value={summary.pendingInvoices} icon={<FileText className="w-5 h-5" strokeWidth={1.8} />} />
          <StatCard label="Disputed LRs" value={summary.disputed} icon={<AlertTriangle className="w-5 h-5" strokeWidth={1.8} />} tone="warn" />
        </section>
      )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, tone }) {
  return (
    <div className="bg-surface rounded-xl p-lg border border-hairline flex items-center gap-md">
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
          tone === "warn" ? "bg-error-container text-ruby" : "bg-primary-container text-primary"
        }`}
      >
        {icon}
      </div>
      <div>
        <div className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">
          {label}
        </div>
        <div className={`text-xl font-semibold ${tone === "warn" ? "text-ruby" : "text-ink-secondary"}`}>
          {value}
        </div>
      </div>
    </div>
  );
}
