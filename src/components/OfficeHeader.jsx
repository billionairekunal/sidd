"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Bell, Plus } from "lucide-react";
import { useAuth } from "../lib/AuthContext";

const TABS = [
  { to: "/", label: "Overview", officeOnly: true },
  { to: "/lrs/new", label: "Direct Dispatch" },
  { to: "/lrs", label: "History" },
  { to: "/reports", label: "Live Arrivals", officeOnly: true },
  { to: "/fleet", label: "Fleet", officeOnly: true },
  { to: "/payments", label: "Payments", officeOnly: true },
];

export default function OfficeHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const tabs = user?.role === "creator" ? TABS.filter((t) => !t.officeOnly) : TABS;

  return (
    <header className="hidden md:block sticky top-0 z-30 bg-canvas-soft/90 backdrop-blur border-b border-hairline">
      <div className="flex items-end justify-between px-lg lg:px-xxl h-14 gap-4">
        <nav className="flex items-end gap-6 h-full min-w-0 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const active = pathname === tab.to;
            return (
              <Link
                key={tab.to}
                href={tab.to}
                className={`h-full flex items-center px-1 text-[14px] border-b-2 -mb-px whitespace-nowrap transition-colors ${
                  active
                    ? "border-primary text-ink-secondary font-semibold"
                    : "border-transparent text-ink-mute hover:text-ink-secondary"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 self-center shrink-0">
          <button
            title="Notifications"
            className="hidden lg:flex w-9 h-9 items-center justify-center rounded-md text-ink-mute hover:bg-white hover:text-ink-secondary transition-colors"
          >
            <Bell className="w-[18px] h-[18px]" />
          </button>
          <button
            onClick={() => router.push("/lrs/new")}
            className="h-9 px-4 flex items-center gap-1.5 rounded-md bg-primary hover:bg-primary-press text-white text-[13.5px] font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" strokeWidth={2.4} />
            New LR
          </button>
        </div>
      </div>
    </header>
  );
}
