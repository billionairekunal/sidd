"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import OfficeHeader from "../components/OfficeHeader";
import ClientCombobox from "../components/ClientCombobox";
import Select from "../components/Select";
import ScanLR from "../components/ScanLR";

// Form keys the photo scan can fill, and their labels for the "check these" summary.
const SCANNABLE = {
  lrDate: "Date",
  consignorName: "Consignor",
  consignorAddress: "Consignor address",
  consigneeName: "Consignee",
  consigneeAddress: "Consignee address",
  fromLocation: "From",
  toLocation: "To",
  invoiceNo: "Invoice no.",
  deliveryAt: "Delivery at",
  ewayBillNo: "E-way bill no.",
  freightTerms: "Freight terms",
  remarks: "Remarks",
};
const plate = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const emptyItem = () => ({
  noOfPkgs: "",
  saidToContain: "",
  weightKg: "",
  ratePerKg: "",
  freightAmount: "",
  remarks: "",
});

function todayLocalDate() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

export default function NewLR() {
  const router = useRouter();
  const { user } = useAuth();
  // LR Creator doesn't choose freight terms; the LR gets the default ("To Pay").
  const showFreightTerms = user?.role !== "creator";
  const [vehicles, setVehicles] = useState([]);
  const [clients, setClients] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    lrDate: todayLocalDate(),
    consignorName: "",
    consignorAddress: "",
    consigneeName: "",
    consigneeAddress: "",
    vehicleId: "",
    fromLocation: "",
    toLocation: "",
    invoiceNo: "",
    deliveryAt: "",
    ewayBillNo: "",
    freightTerms: "To Pay",
    remarks: "",
    status: "Draft",
  });
  const [items, setItems] = useState([emptyItem()]);
  // Fields filled from a scanned photo: highlighted until the person edits them.
  const [aiFilled, setAiFilled] = useState(() => new Set());
  const [scanNote, setScanNote] = useState(null);

  useEffect(() => {
    api.vehicles.list().then(setVehicles).catch((err) => setError(err.message));
    api.clients.list().then(setClients).catch((err) => setError(err.message));
  }, []);

  const availableVehicles = useMemo(
    () => vehicles.filter((v) => v.status === "Available" || String(v.id) === form.vehicleId),
    [vehicles, form.vehicleId]
  );

  const totalAmount = useMemo(
    () => items.reduce((sum, item) => sum + (parseFloat(item.freightAmount) || 0), 0),
    [items]
  );

  function clearAi(key) {
    setAiFilled((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    clearAi(field);
  }

  function applyScan({ legible, fields, items: scannedItems, unclearFields }) {
    const filled = new Set();
    const patch = {};
    for (const key of Object.keys(SCANNABLE)) {
      if (key === "freightTerms" && !showFreightTerms) continue;
      if (fields[key]) {
        patch[key] = fields[key];
        filled.add(key);
      }
    }

    // Use the saved client when the scanned consignor matches one.
    const client = fields.consignorName
      ? clients.find((c) => c.name.toLowerCase() === fields.consignorName.toLowerCase())
      : null;
    if (client) {
      patch.consignorName = client.name;
      if (!fields.consignorAddress && client.address) {
        patch.consignorAddress = client.address;
        filled.add("consignorAddress");
      }
    }

    // Pick the vehicle when the scanned number matches one in the list.
    let vehicleNote = "";
    if (fields.vehicleNo) {
      const v = vehicles.find((x) => plate(x.vehicle_no) === plate(fields.vehicleNo));
      if (v && v.status === "Available") {
        patch.vehicleId = String(v.id);
        filled.add("vehicleId");
      } else {
        vehicleNote = v
          ? `Vehicle ${v.vehicle_no} is ${v.status.toLowerCase()} right now, so it wasn't selected.`
          : `Vehicle "${fields.vehicleNo}" isn't in your vehicle list — pick it by hand or add it in Vehicles & Clients.`;
      }
    }

    setForm((f) => ({ ...f, ...patch }));
    if (scannedItems.length) {
      setItems(scannedItems.map((i) => ({ ...emptyItem(), ...i })));
      filled.add("items");
    }
    setAiFilled(filled);
    setScanNote({ count: filled.size, legible, unclearFields, vehicleNote });
  }

  function updateItem(index, field, value) {
    setItems((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
    clearAi("items");
  }

  function applyClient(client) {
    setForm((f) => ({ ...f, consignorName: client.name, consignorAddress: client.address || "" }));
    clearAi("consignorName");
    clearAi("consignorAddress");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.consignorName || !form.consigneeName || !form.fromLocation || !form.toLocation) {
      setError("Consignor, consignee, from, and to are required.");
      return;
    }
    setSaving(true);
    try {
      const { freightTerms, ...rest } = form;
      const lr = await api.lrs.create({
        ...rest,
        ...(showFreightTerms ? { freightTerms } : {}),
        vehicleId: form.vehicleId ? Number(form.vehicleId) : null,
        amount: totalAmount,
        items,
      });
      router.push(`/lrs/${lr.id}/invoice`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <OfficeHeader />
      <div className="p-lg md:p-xxl space-y-xl max-w-5xl">
      <header>
        <h1 className="text-3xl font-semibold text-ink-secondary">Direct Dispatch — New Lorry Receipt</h1>
        <p className="text-on-surface-variant text-sm mt-xs">
          Digital replacement for the Siddheshwer Transport carbon-copy LR.
        </p>
      </header>

      <ScanLR onResult={applyScan} />

      {scanNote && <ScanSummary note={scanNote} onClose={() => setScanNote(null)} />}

      {error && <p className="text-error bg-error-container/40 px-md py-sm rounded-lg">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-xl">
        <section className="bg-surface rounded-xl border border-hairline p-lg space-y-md">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
            <Field label="Date" ai={aiFilled.has("lrDate")}>
              <input
                type="date"
                value={form.lrDate}
                onChange={(e) => updateField("lrDate", e.target.value)}
                className="input"
                required
              />
            </Field>
            <Field label="Vehicle (available only)" ai={aiFilled.has("vehicleId")}>
              <Select
                value={form.vehicleId}
                onChange={(v) => updateField("vehicleId", v)}
                placeholder="Select vehicle"
                options={[
                  { value: "", label: "No vehicle yet", hint: "Assign one later" },
                  ...availableVehicles.map((v) => ({
                    value: String(v.id),
                    label: v.vehicle_no,
                    hint: [v.vehicle_type, v.driver_name || "no driver"].filter(Boolean).join(" · "),
                  })),
                ]}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-lg pt-md border-t border-hairline">
            <div className="space-y-md">
              <Field label="Consignor Name" ai={aiFilled.has("consignorName")}>
                <ClientCombobox
                  value={form.consignorName}
                  onChange={(v) => updateField("consignorName", v)}
                  onPick={applyClient}
                  clients={clients}
                  required
                />
              </Field>
              <Field label="Consignor Address" ai={aiFilled.has("consignorAddress")}>
                <input
                  className="input"
                  value={form.consignorAddress}
                  onChange={(e) => updateField("consignorAddress", e.target.value)}
                />
              </Field>
            </div>
            <div className="space-y-md">
              <Field label="Consignee Name" ai={aiFilled.has("consigneeName")}>
                <input
                  className="input"
                  value={form.consigneeName}
                  onChange={(e) => updateField("consigneeName", e.target.value)}
                  required
                />
              </Field>
              <Field label="Consignee Address" ai={aiFilled.has("consigneeAddress")}>
                <input
                  className="input"
                  value={form.consigneeAddress}
                  onChange={(e) => updateField("consigneeAddress", e.target.value)}
                />
              </Field>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-lg pt-md border-t border-hairline">
            <Field label="From" ai={aiFilled.has("fromLocation")}>
              <input
                className="input"
                value={form.fromLocation}
                onChange={(e) => updateField("fromLocation", e.target.value)}
                required
              />
            </Field>
            <Field label="To" ai={aiFilled.has("toLocation")}>
              <input
                className="input"
                value={form.toLocation}
                onChange={(e) => updateField("toLocation", e.target.value)}
                required
              />
            </Field>
          </div>
        </section>

        <section className="bg-surface rounded-xl border border-hairline p-lg space-y-md">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-ink-secondary flex items-center gap-2 flex-wrap">
              Goods & Freight
              {aiFilled.has("items") && <CheckTag />}
            </h3>
            <button
              type="button"
              onClick={() => setItems((rows) => [...rows, emptyItem()])}
              className="text-sm text-primary hover:text-primary-press font-medium"
            >
              + Add row
            </button>
          </div>
          {/* Phones: one card per goods line, labelled fields in two columns */}
          <div className="md:hidden space-y-3">
            {items.map((item, i) => (
              <div key={i} className="rounded-lg border border-hairline bg-surface-container-low p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold uppercase tracking-wider text-ink-mute">Item {i + 1}</span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setItems((rows) => rows.filter((_, idx) => idx !== i))}
                      className="text-[12.5px] font-semibold text-error px-2 py-1 -mr-2"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <MobileItemField label="Said to Contain">
                  <input
                    className="input"
                    value={item.saidToContain}
                    onChange={(e) => updateItem(i, "saidToContain", e.target.value)}
                  />
                </MobileItemField>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    ["noOfPkgs", "No. of Pkgs", "numeric"],
                    ["weightKg", "Weight (Kg)", "decimal"],
                    ["ratePerKg", "Rate / Kg", "decimal"],
                    ["freightAmount", "Freight (₹)", "decimal"],
                  ].map(([key, label, mode]) => (
                    <MobileItemField key={key} label={label}>
                      <input
                        className="input"
                        inputMode={mode}
                        value={item[key]}
                        onChange={(e) => updateItem(i, key, e.target.value)}
                      />
                    </MobileItemField>
                  ))}
                </div>
                <MobileItemField label="Remarks">
                  <input className="input" value={item.remarks} onChange={(e) => updateItem(i, "remarks", e.target.value)} />
                </MobileItemField>
              </div>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="text-xs text-on-surface-variant uppercase tracking-wider border-b border-hairline">
                  <th className="py-sm pr-sm">No. of Pkgs</th>
                  <th className="py-sm pr-sm">Said to Contain</th>
                  <th className="py-sm pr-sm">Weight (Kg)</th>
                  <th className="py-sm pr-sm">Rate/Kg</th>
                  <th className="py-sm pr-sm">Freight (₹)</th>
                  <th className="py-sm pr-sm">Remarks</th>
                  <th className="py-sm"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {items.map((item, i) => (
                  <tr key={i}>
                    <td className="py-xs pr-sm">
                      <input
                        className="input-sm"
                        value={item.noOfPkgs}
                        onChange={(e) => updateItem(i, "noOfPkgs", e.target.value)}
                      />
                    </td>
                    <td className="py-xs pr-sm">
                      <input
                        className="input-sm"
                        value={item.saidToContain}
                        onChange={(e) => updateItem(i, "saidToContain", e.target.value)}
                      />
                    </td>
                    <td className="py-xs pr-sm">
                      <input
                        className="input-sm"
                        value={item.weightKg}
                        onChange={(e) => updateItem(i, "weightKg", e.target.value)}
                      />
                    </td>
                    <td className="py-xs pr-sm">
                      <input
                        className="input-sm"
                        value={item.ratePerKg}
                        onChange={(e) => updateItem(i, "ratePerKg", e.target.value)}
                      />
                    </td>
                    <td className="py-xs pr-sm">
                      <input
                        className="input-sm"
                        value={item.freightAmount}
                        onChange={(e) => updateItem(i, "freightAmount", e.target.value)}
                      />
                    </td>
                    <td className="py-xs pr-sm">
                      <input
                        className="input-sm"
                        value={item.remarks}
                        onChange={(e) => updateItem(i, "remarks", e.target.value)}
                      />
                    </td>
                    <td className="py-xs">
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setItems((rows) => rows.filter((_, idx) => idx !== i))}
                          className="text-error text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end text-sm font-semibold text-ink-secondary">
            Total Freight: ₹{totalAmount.toLocaleString("en-IN")}
          </div>
        </section>

        <section className="bg-surface rounded-xl border border-hairline p-lg space-y-md">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
            <Field label="Invoice No." ai={aiFilled.has("invoiceNo")}>
              <input
                className="input"
                value={form.invoiceNo}
                onChange={(e) => updateField("invoiceNo", e.target.value)}
              />
            </Field>
            <Field label="Delivery At" ai={aiFilled.has("deliveryAt")}>
              <input
                className="input"
                value={form.deliveryAt}
                onChange={(e) => updateField("deliveryAt", e.target.value)}
              />
            </Field>
            <Field label="E-way Bill No." ai={aiFilled.has("ewayBillNo")}>
              <input
                className="input"
                value={form.ewayBillNo}
                onChange={(e) => updateField("ewayBillNo", e.target.value)}
              />
            </Field>
            {showFreightTerms && (
            <Field label="Freight Terms" ai={aiFilled.has("freightTerms")}>
              <Select
                value={form.freightTerms}
                onChange={(v) => updateField("freightTerms", v)}
                options={[
                  { value: "Paid", label: "Paid", hint: "Freight paid at booking" },
                  { value: "To Pay", label: "To Pay", hint: "Consignee pays on delivery" },
                  { value: "To Be Billed", label: "To Be Billed", hint: "Invoiced to the party later" },
                ]}
              />
            </Field>
            )}
          </div>
          <p className="text-xs text-on-surface-variant bg-surface-container rounded-lg px-md py-sm">
            With a vehicle selected, the LR goes straight to <strong>In Transit</strong>. Without
            one it's saved as <strong>Draft</strong> — mark it In Transit later from the LR page.
          </p>
          <Field label="Remarks" ai={aiFilled.has("remarks")}>
            <textarea
              className="input"
              rows={2}
              value={form.remarks}
              onChange={(e) => updateField("remarks", e.target.value)}
            />
          </Field>
        </section>

        <div className="flex justify-end gap-md">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-xl py-md rounded-full border border-hairline text-on-surface-variant"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-xl py-md rounded-full bg-primary hover:bg-primary-press text-on-primary font-medium disabled:opacity-60"
          >
            {saving ? "Saving…" : "Create Lorry Receipt"}
          </button>
        </div>
      </form>
      </div>
    </div>
  );
}

function Field({ label, ai = false, children }) {
  return (
    <label className="flex flex-col gap-xs text-sm">
      <span className="font-medium text-on-surface-variant flex items-center gap-2">
        {label}
        {ai && <CheckTag />}
      </span>
      {/* Filled from the scanned photo: highlighted until edited */}
      <div className={ai ? "rounded-lg ring-2 ring-amber-300 bg-amber-50 [&_.input]:bg-amber-50" : ""}>{children}</div>
    </label>
  );
}

function CheckTag() {
  return (
    <span className="inline-flex items-center rounded bg-amber-100 text-amber-800 text-[10.5px] font-bold uppercase tracking-wide px-1.5 py-0.5">
      From photo · check
    </span>
  );
}

function ScanSummary({ note, onClose }) {
  const unclear = note.unclearFields.length ? note.unclearFields.join(", ") : "";
  const good = note.legible && note.count > 0;
  return (
    <div
      className={`rounded-lg border px-4 py-3 text-[13px] flex gap-3 items-start ${
        good ? "border-amber-200 bg-amber-50 text-amber-900" : "border-[#f8d4d4] bg-[#fdf2f2] text-[#991b1b]"
      }`}
    >
      <div className="flex-1 space-y-1">
        <p className="font-semibold">
          {!note.legible
            ? "The photo was hard to read. Please retake it in good light with the whole LR in the frame."
            : note.count
              ? `Filled ${note.count} field${note.count === 1 ? "" : "s"} from the photo. Please check the highlighted fields before saving.`
              : "Couldn't find LR details in this photo. Please retake it or fill the form by hand."}
        </p>
        {unclear && <p>Couldn't read clearly: {unclear}.</p>}
        {note.vehicleNote && <p>{note.vehicleNote}</p>}
      </div>
      <button type="button" onClick={onClose} className="text-[12px] font-semibold underline shrink-0">
        Dismiss
      </button>
    </div>
  );
}

function MobileItemField({ label, children }) {
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-[12px] font-medium text-on-surface-variant">{label}</span>
      {children}
    </label>
  );
}
