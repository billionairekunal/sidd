"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "../lib/api";
import { amountInWords } from "../lib/amountInWords";

const COMPANY = {
  name: "SIDDHESHWER TRANSPORT",
  tagline: "Fleet Owners & Transport Contractors",
  address: "A/p. Kuruli, Tal. Khed, Dist. Pune – 410 501, Maharashtra, India",
};

const INK = "#111827";
const NAVY = "#1b2a4a";
const RULE = "border-[#111827]";
const SERIF = { fontFamily: 'Georgia, "Times New Roman", serif' };

const inr = (n) =>
  Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (v) => Number.parseFloat(v) || 0;

function fmtDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function Caption({ children }) {
  return (
    <p className="text-[8.5px] font-semibold uppercase tracking-[0.12em] text-[#4b5563] leading-none mb-1">
      {children}
    </p>
  );
}

function Cell({ label, value, className = "" }) {
  return (
    <div className={`px-3 py-2 ${className}`}>
      <Caption>{label}</Caption>
      <p className="text-[11.5px] font-semibold leading-snug break-words" style={{ color: INK }}>
        {value || "—"}
      </p>
    </div>
  );
}

function SectionHead({ children }) {
  return (
    <div className={`px-3 py-1 border-b ${RULE} bg-[#f3f4f6]`}>
      <p className="text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: NAVY }}>
        {children}
      </p>
    </div>
  );
}

function Party({ title, name, address, className = "" }) {
  return (
    <div className={className}>
      <SectionHead>{title}</SectionHead>
      <div className="px-3 py-2">
        <p className="text-[12.5px] font-bold" style={{ color: INK }}>{name || "—"}</p>
        <p className="text-[10.5px] text-[#374151] mt-0.5 whitespace-pre-line leading-relaxed">
          {address || "—"}
        </p>
      </div>
    </div>
  );
}

export default function LRInvoice() {
  const { id } = useParams();
  const [lr, setLr] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.lrs.get(id).then(setLr).catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    if (lr) document.title = `${lr.lr_no} — Siddheshwer Transport Invoice`;
  }, [lr]);

  // Phones: shrink the A4 sheet (794px) to fit the screen. Printing resets this to 1 (see globals.css).
  const [fit, setFit] = useState(1);
  useEffect(() => {
    const update = () => setFit(Math.min(1, (window.innerWidth - 16) / 794));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  if (error) return <p className="p-10 text-error">{error}</p>;
  if (!lr) return <p className="p-10 text-on-surface-variant">Loading invoice…</p>;

  const items = lr.items || [];
  const totals = items.reduce(
    (t, i) => ({
      pkgs: t.pkgs + num(i.no_of_pkgs),
      weight: t.weight + num(i.weight_kg),
      freight: t.freight + num(i.freight_amount),
    }),
    { pkgs: 0, weight: 0, freight: 0 }
  );
  const grandTotal = num(lr.amount) || totals.freight;
  // ponytail: no taxes/extra charges are stored on an LR, so total = freight. Add rows when the schema has them.
  const blankRows = Math.max(0, 9 - items.length);
  const td = `py-1.5 px-2.5 border-r ${RULE} last:border-r-0`;

  return (
    <div className="min-h-screen bg-[#e5e7eb] print:bg-white py-4 sm:py-8 print:py-0 overflow-x-hidden">
      {/* Toolbar — never printed */}
      <div className="print:hidden max-w-[210mm] mx-auto mb-4 px-3 sm:px-1 flex items-center justify-between gap-3">
        <Link href={`/lrs/${lr.id}`} className="text-sm font-medium text-[#1b2a4a] hover:underline">
          ← Back to {lr.lr_no}
        </Link>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-5 py-2 rounded-[4px] bg-[#1b2a4a] hover:bg-[#111827] text-white text-sm font-semibold"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <path d="M6 14h12v8H6z" />
          </svg>
          Print Invoice
        </button>
      </div>

      {/* A4 sheet */}
      <article
        className="invoice-sheet bg-white mx-auto w-[210mm] min-h-[297mm] shadow-xl print:shadow-none px-[12mm] py-[10mm] flex flex-col"
        style={{ color: INK, zoom: fit }}
      >
        {/* Letterhead */}
        <header className="flex items-start justify-between gap-6 pb-3">
          <div className="flex items-center gap-4">
            <div
              className="w-[54px] h-[54px] flex items-center justify-center border-2 text-[22px] font-bold"
              style={{ ...SERIF, borderColor: NAVY, color: NAVY }}
            >
              ST
            </div>
            <div>
              <h1 className="text-[24px] leading-none font-bold tracking-[0.04em] whitespace-nowrap" style={{ ...SERIF, color: NAVY }}>
                {COMPANY.name}
              </h1>
              <p className="text-[9.5px] uppercase tracking-[0.24em] text-[#374151] mt-1.5 font-semibold">
                {COMPANY.tagline}
              </p>
              <p className="text-[10px] text-[#4b5563] mt-1">{COMPANY.address}</p>
            </div>
          </div>
          <div className="text-right shrink-0 pt-1">
            <p className="text-[14px] font-bold tracking-[0.12em]" style={{ color: NAVY }}>
              FREIGHT INVOICE
            </p>
            <p className="text-[9px] uppercase tracking-[0.16em] text-[#4b5563] mt-0.5">
              Lorry Receipt / Consignment Note
            </p>
            <p className={`inline-block mt-2 border ${RULE} px-2 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.14em]`}>
              Original — Consignor Copy
            </p>
          </div>
        </header>
        <div className="border-t-[3px] border-b" style={{ borderColor: NAVY, height: 4 }} />

        {/* Body frame */}
        <div className={`mt-3 border ${RULE} flex flex-col`}>
          {/* LR meta */}
          <div className={`grid grid-cols-4 divide-x divide-[#111827] border-b ${RULE}`}>
            <Cell label="LR Number" value={<span className="text-[13.5px] font-bold">{lr.lr_no}</span>} />
            <Cell label="LR Date" value={fmtDate(lr.lr_date)} />
            <Cell label="Freight Terms" value={lr.freight_terms} />
            <Cell label="Status" value={lr.status} />
          </div>

          {/* Parties */}
          <div className={`grid grid-cols-2 divide-x divide-[#111827] border-b ${RULE}`}>
            <Party title="Consignor (Sender)" name={lr.consignor_name} address={lr.consignor_address} />
            <Party title="Consignee (Receiver)" name={lr.consignee_name} address={lr.consignee_address} />
          </div>

          {/* Shipment details */}
          <SectionHead>Shipment Details</SectionHead>
          <div className={`grid grid-cols-4 border-b ${RULE} [&>*]:border-[#d1d5db] [&>*:not(:nth-child(4n))]:border-r [&>*:nth-child(-n+4)]:border-b`}>
            <Cell label="From" value={lr.from_location} />
            <Cell label="To" value={lr.to_location} />
            <Cell label="Delivery At" value={lr.delivery_at} />
            <Cell label="Party Invoice No." value={lr.invoice_no} />
            <Cell label="Vehicle No." value={lr.vehicle?.vehicle_no} />
            <Cell label="Vehicle Type" value={lr.vehicle?.vehicle_type} />
            <Cell
              label="Driver / Mobile"
              value={lr.vehicle ? `${lr.vehicle.driver_name || "—"} / ${lr.vehicle.driver_phone || "—"}` : ""}
            />
            <Cell label="E-Way Bill No." value={lr.eway_bill_no} />
          </div>

          {/* Goods */}
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className={`bg-[#f3f4f6] border-b ${RULE} text-[8.5px] uppercase tracking-[0.12em]`} style={{ color: NAVY }}>
                <th className={`${td} text-center w-[28px] font-bold`}>S.No</th>
                <th className={`${td} text-right w-[52px] font-bold`}>Pkgs</th>
                <th className={`${td} text-left font-bold`}>Description of Goods (Said to Contain)</th>
                <th className={`${td} text-right w-[86px] font-bold whitespace-nowrap`}>Weight (kg)</th>
                <th className={`${td} text-right w-[68px] font-bold whitespace-nowrap`}>Rate / kg</th>
                <th className={`${td} text-right w-[96px] font-bold`}>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id} className="border-b border-[#d1d5db] align-top">
                  <td className={`${td} text-center`}>{idx + 1}</td>
                  <td className={`${td} text-right`}>{item.no_of_pkgs || "—"}</td>
                  <td className={td}>
                    <span className="font-semibold">{item.said_to_contain || "—"}</span>
                    {item.remarks && <span className="text-[9.5px] text-[#4b5563]"> — {item.remarks}</span>}
                  </td>
                  <td className={`${td} text-right`}>{item.weight_kg || "—"}</td>
                  <td className={`${td} text-right`}>{item.rate_per_kg || "—"}</td>
                  <td className={`${td} text-right`}>{item.freight_amount ? inr(item.freight_amount) : "—"}</td>
                </tr>
              ))}
              {Array.from({ length: blankRows }).map((_, i) => (
                <tr key={`blank-${i}`} className="border-b border-[#d1d5db] h-[26px]">
                  {Array.from({ length: 6 }).map((__, c) => (
                    <td key={c} className={td} />
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className={`border-t ${RULE} border-b font-bold bg-[#f9fafb]`}>
                <td className={td} />
                <td className={`${td} text-right`}>{totals.pkgs || "—"}</td>
                <td className={`${td} text-[9px] uppercase tracking-[0.14em]`}>Total</td>
                <td className={`${td} text-right`}>{totals.weight ? totals.weight.toLocaleString("en-IN") : "—"}</td>
                <td className={td} />
                <td className={`${td} text-right`}>{inr(totals.freight)}</td>
              </tr>
            </tfoot>
          </table>

          {/* Amount block */}
          <div className="grid grid-cols-[1fr_64mm] divide-x divide-[#111827]">
            <div className="flex flex-col">
              <div className={`px-3 py-2 border-b ${RULE}`}>
                <Caption>Amount Chargeable (in words)</Caption>
                <p className="text-[11px] font-semibold">{amountInWords(grandTotal)}</p>
              </div>
              <div className="px-3 py-2 flex-1">
                <Caption>Remarks</Caption>
                <p className="text-[10.5px] text-[#374151] whitespace-pre-line">{lr.remarks || "—"}</p>
              </div>
            </div>
            <div className="text-[11px]">
              <div className="flex justify-between px-3 py-1.5 border-b border-[#d1d5db]">
                <span className="text-[#4b5563]">Freight Charges</span>
                <span>{inr(totals.freight)}</span>
              </div>
              <div className="flex justify-between px-3 py-1.5 border-b border-[#d1d5db]">
                <span className="text-[#4b5563]">Payment Basis</span>
                <span>{lr.freight_terms}</span>
              </div>
              <div className="flex justify-between items-baseline px-3 py-2.5" style={{ backgroundColor: NAVY, color: "#fff" }}>
                <span className="text-[9.5px] font-bold uppercase tracking-[0.14em]">Grand Total</span>
                <span className="text-[15px] font-bold">₹ {inr(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Terms */}
        <section className="mt-3">
          <p className="text-[8.5px] font-bold uppercase tracking-[0.16em] mb-1" style={{ color: NAVY }}>
            Terms &amp; Conditions
          </p>
          <ol className="list-decimal pl-4 text-[8.5px] text-[#374151] leading-[1.55] grid grid-cols-2 gap-x-8">
            <li>Goods are carried at owner's risk. The carrier is not liable for leakage, breakage or damage due to packing.</li>
            <li>Goods are booked on the consignor's declaration of contents, weight and value.</li>
            <li>Consignee must verify goods at the time of delivery. No claim will be entertained thereafter.</li>
            <li>Payment is due as per agreed credit terms. Delayed payment may attract interest.</li>
            <li>The carrier reserves the right to retain goods until all dues are cleared.</li>
            <li>All disputes are subject to Pune jurisdiction only.</li>
          </ol>
        </section>

        {/* Signatures */}
        <section className="grid grid-cols-4 gap-6 mt-auto pt-6 items-end">
          {["Consignor's Signature", "Driver's Signature", "Receiver's Signature & Stamp"].map((s) => (
            <div key={s} className="text-center pt-12">
              <div className="border-t border-[#6b7280] pt-1 text-[9px] text-[#374151]">{s}</div>
            </div>
          ))}
          <div className="text-center">
            <p className="text-[9.5px] font-bold mb-10" style={{ color: NAVY }}>For {COMPANY.name}</p>
            <div className="border-t border-[#6b7280] pt-1 text-[9px] text-[#374151]">Authorised Signatory</div>
          </div>
        </section>

        <footer className="mt-4 pt-2 border-t border-[#d1d5db] flex justify-between text-[8.5px] text-[#6b7280]">
          <span>Subject to Pune jurisdiction · This is a computer-generated document.</span>
          <span>Printed on {fmtDate(new Date())}</span>
        </footer>
      </article>
    </div>
  );
}
