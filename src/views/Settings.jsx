"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import Select from "../components/Select";
import OfficeHeader from "../components/OfficeHeader";

const VEHICLE_STATUSES = ["Available", "Loading", "In Transit", "Maintenance", "Idle"];

export default function Settings() {
  const [tab, setTab] = useState("vehicles");

  return (
    <div className="flex-1 flex flex-col">
      <OfficeHeader />
      <div className="p-lg md:p-xxl space-y-xl">
      <header>
        <h1 className="text-3xl font-semibold text-ink-secondary">Settings</h1>
        <p className="text-on-surface-variant text-sm mt-xs">Manage your fleet and client masters.</p>
      </header>

      <div className="flex gap-sm">
        <button
          onClick={() => setTab("vehicles")}
          className={`px-lg py-sm rounded-full text-sm font-medium border ${
            tab === "vehicles" ? "bg-primary-fixed border-primary text-primary-deep" : "border-hairline text-on-surface-variant"
          }`}
        >
          Vehicles
        </button>
        <button
          onClick={() => setTab("clients")}
          className={`px-lg py-sm rounded-full text-sm font-medium border ${
            tab === "clients" ? "bg-primary-fixed border-primary text-primary-deep" : "border-hairline text-on-surface-variant"
          }`}
        >
          Clients
        </button>
      </div>

      {tab === "vehicles" ? <VehiclesPanel /> : <ClientsPanel />}
      </div>
    </div>
  );
}

function VehiclesPanel() {
  const [vehicles, setVehicles] = useState([]);
  const expiredCount = vehicles.filter((v) => paperStatus(v).expired.length).length;
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    vehicleNo: "",
    vehicleType: "",
    driverName: "",
    driverPhone: "",
    ownerName: "",
    capacityKg: "",
  });

  function reload() {
    api.vehicles.list().then(setVehicles).catch((err) => setError(err.message));
  }
  useEffect(reload, []);

  async function handleAdd(e) {
    e.preventDefault();
    setError("");
    try {
      await api.vehicles.create(form);
      setForm({ vehicleNo: "", vehicleType: "", driverName: "", driverPhone: "", ownerName: "", capacityKg: "" });
      reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleStatusChange(id, status) {
    await api.vehicles.update(id, { status });
    reload();
  }

  async function handleDelete(id) {
    if (!confirm("Remove this vehicle?")) return;
    await api.vehicles.remove(id);
    reload();
  }

  return (
    <div className="space-y-lg">
      {error && <p className="text-error">{error}</p>}
      <form onSubmit={handleAdd} className="bg-surface rounded-xl border border-hairline p-lg grid grid-cols-2 md:grid-cols-6 gap-md items-end">
        <input className="input" placeholder="Vehicle No." value={form.vehicleNo} onChange={(e) => setForm((f) => ({ ...f, vehicleNo: e.target.value }))} required />
        <input className="input" placeholder="Type (e.g. SXL / MXL)" value={form.vehicleType} onChange={(e) => setForm((f) => ({ ...f, vehicleType: e.target.value }))} />
        <input className="input" placeholder="Driver Name" value={form.driverName} onChange={(e) => setForm((f) => ({ ...f, driverName: e.target.value }))} />
        <input className="input" placeholder="Driver Phone" value={form.driverPhone} onChange={(e) => setForm((f) => ({ ...f, driverPhone: e.target.value }))} />
        <input className="input" placeholder="Owner" value={form.ownerName} onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value }))} />
        <button type="submit" className="px-lg py-sm rounded-full bg-primary text-on-primary font-medium">Add Vehicle</button>
      </form>

      <p className="text-sm text-on-surface-variant">
        {vehicles.length} vehicles
        {expiredCount > 0 && (
          <span className="text-[#b91c1c] font-semibold"> · {expiredCount} with expired papers</span>
        )}
      </p>

      <div className="bg-surface rounded-xl border border-hairline overflow-hidden">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="text-xs text-on-surface-variant uppercase tracking-wider border-b border-hairline bg-canvas-soft">
              <th className="py-sm px-lg">Vehicle No.</th>
              <th className="py-sm px-lg">Type</th>
              <th className="py-sm px-lg">Driver</th>
              <th className="py-sm px-lg">Owner</th>
              <th className="py-sm px-lg">Papers</th>
              <th className="py-sm px-lg">Status</th>
              <th className="py-sm px-lg"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {vehicles.map((v) => (
              <tr key={v.id}>
                <td className="py-sm px-lg font-medium">{v.vehicle_no}</td>
                <td className="py-sm px-lg text-on-surface-variant">{v.vehicle_type || "—"}</td>
                <td className="py-sm px-lg text-on-surface-variant">{v.driver_name || "—"}</td>
                <td className="py-sm px-lg text-on-surface-variant">{v.owner_name || v.affiliated_company || "—"}</td>
                <td className="py-sm px-lg">
                  <PapersBadge v={v} />
                </td>
                <td className="py-sm px-lg">
                  <Select
                    size="sm"
                    className="w-40"
                    value={v.status}
                    onChange={(s) => handleStatusChange(v.id, s)}
                    options={VEHICLE_STATUSES.map((s) => ({ value: s, label: s }))}
                  />
                </td>
                <td className="py-sm px-lg">
                  <button onClick={() => handleDelete(v.id)} className="text-error text-xs">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ClientsPanel() {
  const [clients, setClients] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", gstin: "", address: "", paymentTermsDays: 21 });

  function reload() {
    api.clients.list().then(setClients).catch((err) => setError(err.message));
  }
  useEffect(reload, []);

  async function handleAdd(e) {
    e.preventDefault();
    setError("");
    try {
      await api.clients.create(form);
      setForm({ name: "", gstin: "", address: "", paymentTermsDays: 21 });
      reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Remove this client?")) return;
    await api.clients.remove(id);
    reload();
  }

  return (
    <div className="space-y-lg">
      {error && <p className="text-error">{error}</p>}
      <form onSubmit={handleAdd} className="bg-surface rounded-xl border border-hairline p-lg grid grid-cols-2 md:grid-cols-5 gap-md items-end">
        <input className="input" placeholder="Client Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
        <input className="input" placeholder="GSTIN" value={form.gstin} onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value }))} />
        <input className="input" placeholder="Address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
        <input
          className="input"
          type="number"
          placeholder="Payment Terms (days)"
          value={form.paymentTermsDays}
          onChange={(e) => setForm((f) => ({ ...f, paymentTermsDays: Number(e.target.value) }))}
        />
        <button type="submit" className="px-lg py-sm rounded-full bg-primary text-on-primary font-medium">Add Client</button>
      </form>

      <div className="bg-surface rounded-xl border border-hairline overflow-hidden">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="text-xs text-on-surface-variant uppercase tracking-wider border-b border-hairline bg-canvas-soft">
              <th className="py-sm px-lg">Name</th>
              <th className="py-sm px-lg">GSTIN</th>
              <th className="py-sm px-lg">Address</th>
              <th className="py-sm px-lg">Payment Terms</th>
              <th className="py-sm px-lg"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {clients.map((c) => (
              <tr key={c.id}>
                <td className="py-sm px-lg font-medium">{c.name}</td>
                <td className="py-sm px-lg text-on-surface-variant">{c.gstin || "—"}</td>
                <td className="py-sm px-lg text-on-surface-variant">{c.address || "—"}</td>
                <td className="py-sm px-lg text-on-surface-variant">{c.payment_terms_days} days</td>
                <td className="py-sm px-lg">
                  <button onClick={() => handleDelete(c.id)} className="text-error text-xs">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Vehicle papers: which have expired and which expire within 30 days.
const PAPERS = [
  ["fitness_upto", "Fitness"],
  ["tax_upto", "Tax"],
  ["insurance_upto", "Insurance"],
  ["pucc_upto", "PUCC"],
  ["permit_upto", "Permit"],
  ["national_permit_upto", "National permit"],
];
const fmt = (d) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

function paperStatus(v) {
  const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local
  const soon = new Date(Date.now() + 30 * 86400000).toLocaleDateString("en-CA");
  const dated = PAPERS.filter(([key]) => v[key]).map(([key, label]) => ({ label, date: v[key] }));
  return {
    dated,
    expired: dated.filter((p) => p.date < today),
    dueSoon: dated.filter((p) => p.date >= today && p.date <= soon),
  };
}

function PapersBadge({ v }) {
  const { dated, expired, dueSoon } = paperStatus(v);
  if (!dated.length) return <span className="text-on-surface-variant">—</span>;
  const detail = [
    ...dated.map((p) => `${p.label}: ${fmt(p.date)}`),
    v.engine_no && `Engine: ${v.engine_no}`,
    v.chassis_no && `Chassis: ${v.chassis_no}`,
  ]
    .filter(Boolean)
    .join("\n");
  const [cls, text] = expired.length
    ? ["bg-[#fdecec] text-[#b91c1c]", `${expired.map((p) => p.label).join(", ")} expired`]
    : dueSoon.length
      ? ["bg-[#fff4e5] text-[#b45309]", `${dueSoon[0].label} due ${fmt(dueSoon[0].date)}`]
      : ["bg-[#e8f7ee] text-[#15803d]", "All valid"];
  return (
    <span title={detail} className={`inline-block rounded px-2 py-0.5 text-[12px] font-semibold whitespace-nowrap cursor-help ${cls}`}>
      {text}
    </span>
  );
}
