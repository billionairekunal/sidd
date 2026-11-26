"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "../lib/api";
import { amountInWords } from "../lib/amountInWords";

// Way Bill — same fields as the printed paper way bill, nothing extra.
// ponytail: blessing / cell are blank until confirmed from the paper; each line hides while empty.
const COMPANY = {
  blessing: "",
  name: "SIDDHESHWER TRANSPORT",
  address: "A/p. Kuruli, Tal. Khed, Dist. Pune – 410 501",
  gstin: "27AWVPM0141M1Z2",
  cell: "",
};

// Paper colours of the three copies.
const COPIES = ["Consignee Copy", "Truck Copy", "Consignor Copy"];

const DECLARATION =
  "We confirm that neither credit on input/capital goods nor the benefit of notification 12/2017 has been availed by us.";

const INK = "#111827";
const NAVY = "#1b2a4a";
const RULE = "border-[#111827]";

const inr = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (v) => Number.parseFloat(v) || 0;

function fmtDate(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function Label({ children }) {
  return <p className="text-[8.5px] font-semibold uppercase tracking-[0.12em] text-[#6b7280] leading-none mb-1">{children}</p>;
}

// Empty value = a ruled line to fill by hand.
function Value({ children, big }) {
  return children ? (
    <p className={`${big ? "text-[13px]" : "text-[11.5px]"} font-bold leading-snug break-words`} style={{ color: INK }}>
      {children}
    </p>
  ) : (
    <div className="h-[16px] border-b border-dotted border-[#9ca3af]" />
  );
}

function Box({ label, children, className = "", big }) {
  return (
    <div className={`px-3 py-2 ${className}`}>
      <Label>{label}</Label>
      <Value big={big}>{children}</Value>
    </div>
  );
}

function Party({ title, name, address }) {
  return (
    <div className="px-3 py-2.5">
      <Label>{title}</Label>
      <Value big>{name}</Value>
      <p className="text-[10.5px] text-[#374151] mt-1 whitespace-pre-line leading-relaxed min-h-[28px]">{address}</p>
    </div>
  );
}

export default function LRInvoice() {
  const { id } = useParams();
  const [lr, setLr] = useState(null);
  const [error, setError] = useState("");
  const [copy, setCopy] = useState("all");

  useEffect(() => {
    api.lrs.get(id).then(setLr).catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    if (lr) document.title = `${lr.lr_no} — Siddheshwer Transport Way Bill`;
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
  if (!lr) return <p className="p-10 text-on-surface-variant">Loading way bill…</p>;

  const copies = copy === "all" ? COPIES : [copy];

  return (
    <div className="min-h-screen bg-[#e5e7eb] print:bg-white py-4 sm:py-8 print:py-0 overflow-x-hidden">
      {/* Toolbar — never printed */}
      <div className="print:hidden max-w-[210mm] mx-auto mb-4 px-3 sm:px-1 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/lrs/${lr.id}`} className="text-sm font-medium text-[#1b2a4a] hover:underline">
          ← Back to {lr.lr_no}
        </Link>
        <div className="flex items-center gap-2">
          <select
            value={copy}
            onChange={(e) => setCopy(e.target.value)}
            className="h-9 px-2 rounded-[4px] border border-[#cbd5e1] bg-white text-sm"
            aria-label="Which copy to print"
          >
            <option value="all">All 3 copies</option>
            {COPIES.map((c) => (
              <option key={c} value={c}>{c} only</option>
            ))}
          </select>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-5 h-9 rounded-[4px] bg-[#1b2a4a] hover:bg-[#111827] text-white text-sm font-semibold"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <path d="M6 14h12v8H6z" />
            </svg>
            Print
          </button>
        </div>
      </div>

      <div className="space-y-6 print:space-y-0">
        {copies.map((c, i) => (
          <WayBill key={c} lr={lr} copyLabel={c} fit={fit} last={i === copies.length - 1} />
        ))}
      </div>
    </div>
  );
}

function WayBill({ lr, copyLabel, fit, last }) {
  const items = lr.items || [];
  const paid = lr.freight_terms === "Paid"; // "To Pay" and "To Be Billed" are both still to be paid
  const totals = items.reduce((t, i) => ({ weight: t.weight + num(i.weight_kg), freight: t.freight + num(i.freight_amount) }), {
    weight: 0,
    freight: 0,
  });
  const total = num(lr.amount) || totals.freight;
  const blankRows = Math.max(0, 16 - items.length);
  const td = `py-2 px-2.5 border-r ${RULE} last:border-r-0`;

  return (
    <article
      className={`invoice-sheet bg-white mx-auto w-[210mm] min-h-[297mm] shadow-xl print:shadow-none px-[12mm] py-[10mm] flex flex-col ${
        last ? "" : "print:break-after-page"
      }`}
      style={{ color: INK, zoom: fit }}
    >
      {/* Top line */}
      <div className="flex justify-between items-center text-[9px] uppercase tracking-[0.14em] text-[#4b5563] mb-2">
        <span>Subject to Pune Jurisdiction</span>
        <span className={`border ${RULE} px-2 py-0.5 font-bold text-[#111827]`}>{copyLabel}</span>
      </div>

      {/* Header */}
      <header className={`border ${RULE} grid grid-cols-[1fr_52mm]`}>
        <div className="px-4 py-3 flex items-center gap-4">
          <div
            className="w-[58px] h-[58px] rounded-[999px] flex items-center justify-center text-white text-[22px] font-black shrink-0"
            style={{ backgroundColor: NAVY }}
          >
            ST
          </div>
          <div className="min-w-0 text-center flex-1">
            {COMPANY.blessing && <p className="text-[9.5px] text-[#4b5563] mb-0.5">॥ {COMPANY.blessing} ॥</p>}
            <h1 className="text-[26px] leading-none font-black tracking-[0.06em] whitespace-nowrap" style={{ color: NAVY }}>
              {COMPANY.name}
            </h1>
            <p className="text-[10.5px] text-[#374151] mt-1.5">{COMPANY.address}</p>
            {(COMPANY.gstin || COMPANY.cell) && (
              <p className="text-[10.5px] font-semibold mt-0.5">
                {[COMPANY.gstin && `GSTIN: ${COMPANY.gstin}`, COMPANY.cell && `Cell: ${COMPANY.cell}`].filter(Boolean).join("   ·   ")}
              </p>
            )}
            <p className="inline-block mt-2 px-3 py-0.5 text-[11px] font-bold tracking-[0.3em] text-white" style={{ backgroundColor: NAVY }}>
              WAY BILL
            </p>
          </div>
        </div>
        <div className={`border-l ${RULE} flex flex-col divide-y divide-[#111827]`}>
          <div className="px-3 py-2.5 flex-1">
            <Label>Sr. No.</Label>
            <p className="text-[20px] font-black leading-tight" style={{ color: NAVY }}>{lr.lr_no}</p>
          </div>
          <Box label="Date" big>{fmtDate(lr.lr_date)}</Box>
        </div>
      </header>

      {/* Consignor / Consignee */}
      <div className={`border-x border-b ${RULE} grid grid-cols-2 divide-x divide-[#111827]`}>
        <Party title="Consignor" name={lr.consignor_name} address={lr.consignor_address} />
        <Party title="Consignee" name={lr.consignee_name} address={lr.consignee_address} />
      </div>

      {/* Trip */}
      <div className={`border-x border-b ${RULE} grid grid-cols-5 divide-x divide-[#111827]`}>
        <Box label="Lorry No.">{lr.vehicle?.vehicle_no}</Box>
        <Box label="From">{lr.from_location}</Box>
        <Box label="To">{lr.to_location}</Box>
        <Box label="Invoice No.">{lr.invoice_no}</Box>
        <Box label="Delivery At">{lr.delivery_at}</Box>
      </div>

      {/* Goods */}
      <table className={`w-full text-[11px] border-collapse border-x border-b ${RULE}`}>
        <thead>
          <tr className={`border-b ${RULE} text-[8.5px] uppercase tracking-[0.1em] bg-[#f3f4f6]`} style={{ color: NAVY }}>
            <th rowSpan={2} className={`${td} text-left font-bold`}>Said to Contain</th>
            <th rowSpan={2} className={`${td} text-right font-bold w-[78px]`}>Weight<br />(Kilograms)</th>
            <th rowSpan={2} className={`${td} text-right font-bold w-[64px]`}>Rate<br />Per Kg</th>
            <th colSpan={2} className={`${td} text-center font-bold border-b ${RULE}`}>Freight</th>
            <th rowSpan={2} className={`${td} text-left font-bold w-[110px]`}>Remarks</th>
          </tr>
          <tr className={`border-b ${RULE} text-[8.5px] uppercase tracking-[0.1em] bg-[#f3f4f6]`} style={{ color: NAVY }}>
            <th className={`${td} text-right font-bold w-[88px]`}>To Pay (Rs.)</th>
            <th className={`${td} text-right font-bold w-[88px]`}>Paid (Rs.)</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-[#d1d5db] align-top">
              <td className={`${td} font-semibold`}>
                {item.said_to_contain}
                {item.no_of_pkgs && <span className="font-normal text-[#4b5563]"> ({item.no_of_pkgs} pkgs)</span>}
              </td>
              <td className={`${td} text-right`}>{item.weight_kg}</td>
              <td className={`${td} text-right`}>{item.rate_per_kg}</td>
              <td className={`${td} text-right`}>{!paid && item.freight_amount ? inr(item.freight_amount) : ""}</td>
              <td className={`${td} text-right`}>{paid && item.freight_amount ? inr(item.freight_amount) : ""}</td>
              <td className={`${td} text-[10px] text-[#374151]`}>{item.remarks}</td>
            </tr>
          ))}
          {Array.from({ length: blankRows }).map((_, i) => (
            <tr key={`blank-${i}`} className="border-b border-[#e5e7eb] h-[28px]">
              {Array.from({ length: 6 }).map((__, c) => (
                <td key={c} className={td} />
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className={`border-t ${RULE} font-bold bg-[#f9fafb]`}>
            <td className={`${td} text-[9px] uppercase tracking-[0.14em]`}>Total</td>
            <td className={`${td} text-right`}>{totals.weight ? totals.weight.toLocaleString("en-IN") : ""}</td>
            <td className={td} />
            <td className={`${td} text-right`}>{!paid && total ? `₹ ${inr(total)}` : ""}</td>
            <td className={`${td} text-right`}>{paid && total ? `₹ ${inr(total)}` : ""}</td>
            <td className={`${td} text-[9.5px] font-semibold`}>{lr.freight_terms}</td>
          </tr>
        </tfoot>
      </table>

      {/* Amount in words + remarks */}
      <div className={`border-x border-b ${RULE} grid grid-cols-[1fr_1fr] divide-x divide-[#111827]`}>
        <Box label="Freight in words">{total ? amountInWords(total) : ""}</Box>
        <Box label="Remarks">{lr.remarks}</Box>
      </div>

      {/* Footer: declaration + signature */}
      <section className="mt-auto pt-8 grid grid-cols-[1fr_62mm] gap-8 items-end">
        <p className="text-[9px] text-[#4b5563] leading-relaxed border-l-2 border-[#cbd5e1] pl-2.5">{DECLARATION}</p>
        <div className="text-center">
          <p className="text-[10.5px] font-bold mb-12" style={{ color: NAVY }}>For {COMPANY.name}</p>
          <div className="border-t border-[#6b7280] pt-1 text-[9px] text-[#374151]">Authorised Signatory</div>
        </div>
      </section>
    </article>
  );
}
