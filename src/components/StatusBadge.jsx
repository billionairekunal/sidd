"use client";

// Small solid status tags, as in the reference design.
const STYLES = {
  Draft: "bg-[#eef1f4] text-[#4b5b67] ring-1 ring-inset ring-[#d5dde3]",
  "In Transit": "bg-[#2563eb] text-white",
  Delivered: "bg-[#0e8fa8] text-white",
  Paid: "bg-[#16a34a] text-white",
  Disputed: "bg-[#dc2626] text-white",
  Cancelled: "bg-[#1f2b37] text-white",
};

export default function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-[3px] rounded-[3px] text-[11.5px] font-semibold whitespace-nowrap ${
        STYLES[status] || STYLES.Draft
      }`}
    >
      {status}
    </span>
  );
}
