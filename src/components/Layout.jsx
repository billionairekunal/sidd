"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  FilePlus2,
  Truck,
  Wallet,
  Settings,
  ClipboardList,
  PackageCheck,
  ClipboardCheck,
  Search,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../lib/AuthContext";

// `match(pathname)` decides the active item; default is exact match.
const NAV_BY_ROLE = {
  office: [
    {
      section: "Main",
      items: [
        { to: "/", label: "Dashboard", icon: LayoutDashboard },
        { to: "/reports", label: "Live Arrivals", icon: TrendingUp },
      ],
    },
    {
      section: "Dispatch",
      items: [
        { to: "/lrs/new", label: "New Lorry Receipt", icon: FilePlus2 },
        {
          to: "/lrs",
          label: "LR History",
          icon: Truck,
          match: (p) => p === "/lrs" || (p.startsWith("/lrs/") && p !== "/lrs/new"),
        },
      ],
    },
    { section: "Finance", items: [{ to: "/payments", label: "Payments", icon: Wallet }] },
    { section: "Masters", items: [{ to: "/settings", label: "Vehicles & Clients", icon: Settings }] },
  ],
  // LR Creator: create LRs and look up past ones — nothing else.
  creator: [
    {
      section: "Lorry Receipts",
      items: [
        { to: "/lrs/new", label: "New Lorry Receipt", icon: FilePlus2 },
        { to: "/lrs", label: "LR History", icon: Truck, match: (p) => p === "/lrs" || (p.startsWith("/lrs/") && p !== "/lrs/new") },
      ],
    },
  ],
  receiver: [
    {
      section: "Receiving",
      items: [
        { to: "/delivery", label: "Incoming Deliveries", icon: PackageCheck },
        { to: "/delivery/log", label: "Delivery Log", icon: ClipboardList },
        {
          to: "/inspections",
          label: "Inspections",
          icon: ClipboardCheck,
          match: (p) => p === "/inspections" || p.startsWith("/inspections/"),
        },
      ],
    },
    { section: "Finance", items: [{ to: "/reconciliation", label: "Reconciliation", icon: Wallet }] },
  ],
};

const ROLE_LABEL = {
  creator: "LR Creator",
  owner: "Office Admin",
  dispatcher: "Office Staff",
  receiver: "Receiving / Warehouse",
};

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="w-8 h-8 shrink-0" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#13829f" />
      <path d="M7 11h11v9H7z" fill="#fff" />
      <path d="M18 14h4.5l2.5 3.2V20H18z" fill="#bfe3ec" />
      <circle cx="11" cy="21.5" r="2.2" fill="#0e6a83" stroke="#fff" strokeWidth="1.4" />
      <circle cx="21.5" cy="21.5" r="2.2" fill="#0e6a83" stroke="#fff" strokeWidth="1.4" />
    </svg>
  );
}

// Bottom tab bar on phones: each role's most-used screens (everything else is in the ☰ drawer).
const BOTTOM_TABS = {
  office: [
    { to: "/", label: "Home", icon: LayoutDashboard },
    { to: "/lrs/new", label: "New LR", icon: FilePlus2 },
    { to: "/lrs", label: "History", icon: Truck, match: (p) => p === "/lrs" || (p.startsWith("/lrs/") && p !== "/lrs/new") },
    { to: "/payments", label: "Payments", icon: Wallet },
  ],
  creator: [
    { to: "/lrs/new", label: "New LR", icon: FilePlus2 },
    { to: "/lrs", label: "History", icon: Truck, match: (p) => p === "/lrs" || (p.startsWith("/lrs/") && p !== "/lrs/new") },
  ],
  receiver: [
    { to: "/delivery", label: "Incoming", icon: PackageCheck },
    { to: "/delivery/log", label: "Log", icon: ClipboardList },
    { to: "/inspections", label: "Inspections", icon: ClipboardCheck, match: (p) => p.startsWith("/inspections") },
    { to: "/reconciliation", label: "Payments", icon: Wallet },
  ],
};

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchRef = useRef(null);
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isOffice = user?.role === "owner" || user?.role === "dispatcher";
  const roleKey = isOffice ? "office" : user?.role;
  const canSearch = isOffice || user?.role === "creator";
  const groups = NAV_BY_ROLE[roleKey] || NAV_BY_ROLE.office;
  const bottomTabs = BOTTOM_TABS[roleKey] || BOTTOM_TABS.office;
  const isActive = (item) => (item.match ? item.match(pathname) : pathname === item.to);

  // Close the phone drawer whenever the page changes.
  useEffect(() => setDrawerOpen(false), [pathname]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") setDrawerOpen(false);
      // Ctrl/Cmd+K focuses the LR search, as in the reference design.
      if (canSearch && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canSearch]);

  function handleSearch(e) {
    e.preventDefault();
    if (search.trim()) router.push(`/lrs?search=${encodeURIComponent(search.trim())}`);
  }

  // Shared by the desktop sidebar and the phone drawer.
  const sidebar = (
    <>
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <Logo />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold text-ink-secondary leading-tight truncate">Siddheshwer Transport</p>
          <p className="text-[10.5px] text-ink-mute font-medium">Transport ERP</p>
        </div>
        <button
          onClick={() => setDrawerOpen(false)}
          aria-label="Close menu"
          className="md:hidden w-9 h-9 -mr-1 flex items-center justify-center rounded-md text-[#5b6f7d] hover:bg-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {canSearch && (
        <form onSubmit={handleSearch} className="px-3 pb-3">
          <label className="flex items-center gap-2 h-10 md:h-9 px-2.5 rounded-md bg-white border border-[#d7e1e7] focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 transition">
            <Search className="w-4 h-4 text-ink-mute shrink-0" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search LRs…"
              enterKeyHint="search"
              className="flex-1 min-w-0 bg-transparent text-[14px] md:text-[13px] placeholder:text-ink-mute focus:outline-none"
            />
            <kbd className="hidden md:inline text-[10px] font-mono text-ink-mute bg-surface-container border border-hairline rounded px-1.5 py-0.5">
              Ctrl+K
            </kbd>
          </label>
        </form>
      )}

      <div className="mx-3 border-t border-[#d7e1e7]" />

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {groups.map((group) => (
          <div key={group.section}>
            <p className="px-2.5 mb-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#7a8b98]">
              {group.section}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const { to, label, icon: Icon } = item;
                const active = isActive(item);
                return (
                  <li key={to}>
                    <Link
                      href={to}
                      className={`flex items-center gap-2.5 h-11 md:h-9 px-2.5 rounded-md text-[14px] md:text-[13.5px] transition-colors ${
                        active ? "bg-[#cfe5ed] text-ink-secondary font-semibold" : "text-[#34495a] hover:bg-white/70"
                      }`}
                    >
                      <Icon
                        className={`w-[18px] h-[18px] shrink-0 ${active ? "text-primary" : "text-[#6b7f8d]"}`}
                        strokeWidth={1.8}
                      />
                      <span className="truncate">{label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-[#d7e1e7] px-3 py-3 flex items-center gap-2.5 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="w-8 h-8 rounded-md bg-primary text-white flex items-center justify-center text-[13px] font-bold shrink-0">
          {user?.name?.[0] || "U"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold text-ink-secondary truncate">{user?.name}</p>
          <p className="text-[10.5px] text-ink-mute truncate flex items-center gap-1">
            {user?.role === "receiver" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="On shift" />}
            {ROLE_LABEL[user?.role] || user?.role} · {user?.employeeId}
          </p>
        </div>
        <button
          onClick={logout}
          title="Log out"
          aria-label="Log out"
          className="w-9 h-9 md:w-8 md:h-8 flex items-center justify-center rounded-md text-[#5b6f7d] hover:bg-white hover:text-error transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-canvas-soft font-sans text-on-surface">
      {/* Desktop sidebar */}
      <nav className="hidden md:flex flex-col h-full w-[248px] fixed left-0 top-0 z-40 border-r border-[#dbe5ea] bg-gradient-to-b from-[#eef5f8] to-[#e3edf2]">
        {sidebar}
      </nav>

      {/* Phone drawer */}
      <div
        className={`md:hidden fixed inset-0 z-50 transition ${drawerOpen ? "visible" : "invisible pointer-events-none"}`}
        aria-hidden={!drawerOpen}
      >
        <div
          onClick={() => setDrawerOpen(false)}
          className={`absolute inset-0 bg-[#0f2a35]/40 backdrop-blur-[2px] transition-opacity duration-200 ${
            drawerOpen ? "opacity-100" : "opacity-0"
          }`}
        />
        <nav
          className={`absolute left-0 top-0 h-full w-[84%] max-w-[300px] flex flex-col bg-gradient-to-b from-[#eef5f8] to-[#e3edf2] shadow-2xl transition-transform duration-200 ease-out ${
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {drawerOpen && sidebar}
        </nav>
      </div>

      <div className="flex-1 min-w-0 flex flex-col md:ml-[248px] h-full">
        {/* Phone top bar */}
        <header className="md:hidden sticky top-0 z-30 h-14 shrink-0 flex items-center gap-2 px-2 bg-white/95 backdrop-blur border-b border-hairline pt-[env(safe-area-inset-top)]">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="w-10 h-10 flex items-center justify-center rounded-md text-ink-secondary active:bg-surface-container"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Logo />
          <p className="flex-1 min-w-0 text-[15px] font-bold text-ink-secondary truncate">Siddheshwer Transport</p>
          <div className="w-8 h-8 mr-1 rounded-md bg-primary text-white flex items-center justify-center text-[13px] font-bold shrink-0">
            {user?.name?.[0] || "U"}
          </div>
        </header>

        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden bg-canvas-soft pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>

        {/* Phone bottom tabs */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-hairline pb-[env(safe-area-inset-bottom)]">
          <ul className="flex h-16">
            {bottomTabs.map((item) => {
              const { to, label, icon: Icon } = item;
              const active = isActive(item);
              return (
                <li key={to} className="flex-1">
                  <Link
                    href={to}
                    className={`h-full flex flex-col items-center justify-center gap-1 text-[11px] font-semibold ${
                      active ? "text-primary" : "text-[#6b7f8d]"
                    }`}
                  >
                    <span
                      className={`w-12 h-7 flex items-center justify-center rounded-[999px] transition-colors ${
                        active ? "bg-primary-container" : ""
                      }`}
                    >
                      <Icon className="w-5 h-5" strokeWidth={active ? 2.2 : 1.8} />
                    </span>
                    {label}
                  </Link>
                </li>
              );
            })}
            <li className="flex-1">
              <button
                onClick={() => setDrawerOpen(true)}
                className="w-full h-full flex flex-col items-center justify-center gap-1 text-[11px] font-semibold text-[#6b7f8d]"
              >
                <span className="w-12 h-7 flex items-center justify-center">
                  <Menu className="w-5 h-5" strokeWidth={1.8} />
                </span>
                More
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}
