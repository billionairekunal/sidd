"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../lib/api";
import OfficeHeader from "../components/OfficeHeader";

// Vehicles moved to their own section: /fleet (Fleet & Renewals).
export default function Settings() {
  return (
    <div className="flex-1 flex flex-col">
      <OfficeHeader />
      <div className="p-lg md:p-xxl space-y-xl">
      <header>
        <h1 className="text-3xl font-semibold text-ink-secondary">Clients</h1>
        <p className="text-on-surface-variant text-sm mt-xs">
          Consignor companies and their payment terms. Trucks and their papers are in{" "}
          <Link href="/fleet" className="text-primary font-semibold">Fleet &amp; Renewals</Link>.
        </p>
      </header>
      <ClientsPanel />
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
