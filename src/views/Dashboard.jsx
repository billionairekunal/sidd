"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Truck, CheckCircle2, AlertTriangle, FileText, Plus, History, TrendingUp, Wallet } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { api } from "../lib/api";
import StatusBadge from "../components/StatusBadge";
import OfficeHeader from "../components/OfficeHeader";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

export default function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState(null);
  const [payments, setPayments] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.lrs
      .summary()
      .then(setSummary)
      .catch((err) => setError(err.message));
    api.lrs
      .reconciliationSummary()
      .then(setPayments)
      .catch(() => {});
  }, []);

  const receivedCount = payments?.rows.filter((r) => r.settlementStatus === "Paid").length ?? 0;
  const pendingAfter21 = payments?.rows.filter((r) => r.settlementStatus === "Overdue") ?? [];
  const overdueAmount = pendingAfter21.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="flex-1 flex flex-col">
      <OfficeHeader />
      <div className="p-4 md:px-xxl md:py-xl space-y-5 md:space-y-6">
        <header>
          <h1 className="text-[22px] md:text-[26px] font-bold text-ink-secondary tracking-tight">Dashboard</h1>
          <p className="text-[13.5px] text-ink-mute mt-0.5">
            {greeting()}, {user?.name?.split(" ")[0] || "there"} —{" "}
            {summary
              ? `${summary.activeTrips} trip${summary.activeTrips === 1 ? "" : "s"} in transit right now${
                  summary.disputed ? `, ${summary.disputed} disputed LR(s) need attention` : ""
                }.`
              : "loading fleet status…"}
          </p>
        </header>

        {error && <p className="text-error text-sm">{error}</p>}

        <section className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
          <StatCard icon={Truck} tone="blue" label="Active Trips" value={summary?.activeTrips} hint="Currently in transit" />
          <StatCard
            icon={CheckCircle2}
            tone="green"
            label="Delivered Today"
            value={summary?.deliveredToday}
            hint="Confirmed by receiving"
          />
          <StatCard
            icon={AlertTriangle}
            tone="red"
            label="Disputed LRs"
            value={summary?.disputed}
            hint={summary?.disputed ? "Action needed" : "All clear"}
          />
          <StatCard icon={FileText} tone="teal" label="LRs Created Today" value={summary?.totalToday} hint="Across all routes" />
        </section>

        <section className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2.5">
          <button
            onClick={() => router.push("/lrs/new")}
            className="col-span-2 sm:col-span-1 h-11 sm:h-10 px-4 inline-flex items-center justify-center gap-2 rounded-md bg-primary hover:bg-primary-press text-white text-[14px] font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" strokeWidth={2.4} /> Create Lorry Receipt
          </button>
          <OutlineButton icon={History} onClick={() => router.push("/lrs")}>View History</OutlineButton>
          <OutlineButton icon={TrendingUp} onClick={() => router.push("/reports")}>Live Arrivals</OutlineButton>
          <OutlineButton icon={Wallet} onClick={() => router.push("/payments")}>Payments</OutlineButton>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
          <section className="xl:col-span-2 bg-surface rounded-lg border border-hairline shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h2 className="text-[17px] font-bold text-ink-secondary">Recent Lorry Receipts</h2>
              <button onClick={() => router.push("/lrs")} className="text-[13.5px] font-semibold text-primary hover:text-primary-press">
                View All
              </button>
            </div>
            {/* Phones: card list */}
            <ul className="md:hidden border-t border-hairline divide-y divide-hairline">
              {summary?.recent?.length ? (
                summary.recent.map((lr) => (
                  <li key={lr.id}>
                    <button
                      onClick={() => router.push(`/lrs/${lr.id}`)}
                      className="w-full text-left px-4 py-3.5 active:bg-surface-container-low"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[14.5px] font-bold text-ink-secondary">{lr.lr_no}</span>
                        <StatusBadge status={lr.status} />
                      </div>
                      <p className="text-[13px] text-ink-secondary mt-1 truncate">{lr.consignor_name}</p>
                      <div className="flex items-center justify-between gap-3 mt-1 text-[12px] text-ink-mute">
                        <span className="truncate">
                          {lr.from_location} → {lr.to_location}
                        </span>
                        <span className="shrink-0">{lr.vehicle?.vehicle_no || lr.lr_date}</span>
                      </div>
                    </button>
                  </li>
                ))
              ) : (
                <li className="px-4 py-8 text-center text-[13.5px] text-ink-mute">No lorry receipts yet.</li>
              )}
            </ul>

            <div className="hidden md:block overflow-x-auto px-2 pb-2">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[11px] text-ink-mute uppercase tracking-[0.08em] border-b border-hairline">
                    <th className="py-2.5 px-3 font-semibold">LR No.</th>
                    <th className="py-2.5 px-3 font-semibold">Date</th>
                    <th className="py-2.5 px-3 font-semibold">Consignor</th>
                    <th className="py-2.5 px-3 font-semibold">Route</th>
                    <th className="py-2.5 px-3 font-semibold">Vehicle</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="text-[13.5px] text-ink-secondary">
                  {summary?.recent?.length ? (
                    summary.recent.map((lr) => (
                      <tr
                        key={lr.id}
                        className="border-b border-hairline last:border-b-0 hover:bg-surface-container-low cursor-pointer transition-colors"
                        onClick={() => router.push(`/lrs/${lr.id}`)}
                      >
                        <td className="py-3 px-3 font-semibold whitespace-nowrap">{lr.lr_no}</td>
                        <td className="py-3 px-3 text-[#46525c] whitespace-nowrap">{lr.lr_date}</td>
                        <td className="py-3 px-3">{lr.consignor_name}</td>
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-surface-container px-2 py-1 text-[12.5px] text-[#34495a]">
                            {lr.from_location} <span className="text-ink-mute">→</span> {lr.to_location}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[#46525c] whitespace-nowrap">{lr.vehicle?.vehicle_no || "—"}</td>
                        <td className="py-3 px-3">
                          <StatusBadge status={lr.status} />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-ink-mute">
                        No lorry receipts yet. Create your first one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-surface rounded-lg border border-hairline shadow-[0_1px_2px_rgba(16,24,40,0.04)] p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-[17px] font-bold text-ink-secondary">Payments Received</h2>
              <button onClick={() => router.push("/payments")} className="text-[13.5px] font-semibold text-primary hover:text-primary-press">
                View All
              </button>
            </div>
            <p className="text-[12px] text-ink-mute mb-4">Read-only — the Receiver marks payments released.</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-md border border-[#cdeedb] bg-[#effaf3] px-4 py-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#15803d]">Received</p>
                  <p className="text-[12px] text-[#15803d]/80">Paid within terms</p>
                </div>
                <p className="text-[24px] font-bold text-[#15803d]">{receivedCount}</p>
              </div>
              <div className="flex items-center justify-between rounded-md border border-[#f8d4d4] bg-[#fdf2f2] px-4 py-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#b91c1c]">Pending after 21 days</p>
                  <p className="text-[12px] text-[#b91c1c]/80">
                    {pendingAfter21.length ? `₹${overdueAmount.toLocaleString("en-IN")} overdue` : "None overdue"}
                  </p>
                </div>
                <p className="text-[24px] font-bold text-[#b91c1c]">{pendingAfter21.length}</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

const TONES = {
  blue: "bg-[#e8f0fe] text-[#2563eb]",
  green: "bg-[#e8f7ee] text-[#16a34a]",
  red: "bg-[#fdecec] text-[#dc2626]",
  teal: "bg-[#e3f2f6] text-[#13829f]",
};

function StatCard({ icon: Icon, tone, label, value, hint }) {
  return (
    <div className="bg-surface rounded-lg border border-hairline shadow-[0_1px_2px_rgba(16,24,40,0.04)] p-3.5 md:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-2.5 sm:gap-4">
      <div className={`w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center shrink-0 ${TONES[tone]}`}>
        <Icon className="w-5 h-5 md:w-6 md:h-6" strokeWidth={1.8} />
      </div>
      <div className="min-w-0 w-full">
        <p className="text-[13px] text-ink-mute">{label}</p>
        <p className="text-[24px] leading-tight font-bold text-ink-secondary">{value ?? "—"}</p>
        <p className="text-[11.5px] text-ink-mute truncate">{hint}</p>
      </div>
    </div>
  );
}

function OutlineButton({ icon: Icon, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="h-11 sm:h-10 px-3 sm:px-4 inline-flex items-center justify-center gap-2 rounded-md border border-primary/60 bg-white text-primary hover:bg-primary-container text-[14px] font-semibold transition-colors"
    >
      <Icon className="w-4 h-4" /> {children}
    </button>
  );
}
