"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Truck,
  FileText,
  PackageCheck,
  MapPin,
  Building2,
  FilePlus2,
  IdCard,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "../lib/AuthContext";

const MODES = {
  office: {
    label: "Office",
    icon: Building2,
    placeholder: "Ex: EMP-4920",
    cta: "Sign In to Dashboard",
    demo: "EMP-4920 / dispatch123",
    home: "/",
  },
  creator: {
    label: "LR Creator",
    icon: FilePlus2,
    placeholder: "Ex: CRT-3001",
    cta: "Sign In to Create LRs",
    demo: "CRT-3001 / create123",
    home: "/lrs/new",
  },
  receiver: {
    label: "Receiver",
    icon: PackageCheck,
    placeholder: "Ex: REC-2001",
    cta: "Sign In to Deliveries",
    demo: "REC-2001 / receive123",
    home: "/delivery",
  },
};

const HOME_BY_ROLE = {
  creator: "/lrs/new",
  receiver: "/delivery",
};

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState("office");
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(employeeId, password);
      router.push(HOME_BY_ROLE[user.role] || "/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const active = MODES[mode];
  const field =
    "w-full h-11 pl-10 pr-3 rounded-md border border-[#d5dde3] bg-white text-[14px] placeholder:text-[#9aa7b2] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition";

  return (
    <div className="min-h-screen grid lg:grid-cols-[1fr_1.1fr] bg-canvas-soft font-sans">
      {/* Brand panel */}
      <aside className="hidden lg:flex flex-col justify-between p-12 text-white bg-[#0f2a35] relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <Truck className="w-5 h-5" strokeWidth={2} />
          </div>
          <div>
            <p className="font-bold text-[16px] tracking-wide">SIDDHESHWER TRANSPORT</p>
            <p className="text-[12px] text-white/60">Fleet Owners &amp; Transport Contractors</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-[34px] leading-[1.15] font-bold tracking-tight">
            Every lorry receipt, dispatch and delivery — in one place.
          </h1>
          <ul className="mt-8 space-y-4 text-[14px] text-white/80">
            {[
              [FileText, "Create LRs and print freight invoices in seconds"],
              [Truck, "Track every vehicle from dispatch to delivery"],
              [PackageCheck, "Warehouse confirms delivery and payment"],
            ].map(([Icon, text]) => (
              <li key={text} className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-md bg-white/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-[#7cc4d8]" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative flex items-center gap-2 text-[12px] text-white/50">
          <MapPin className="w-3.5 h-3.5" /> A/p. Kuruli, Tal. Khed, Dist. Pune – 410 501
        </p>
      </aside>

      {/* Form */}
      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px]">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-lg bg-primary text-white flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <p className="font-bold text-ink-secondary">SIDDHESHWER TRANSPORT</p>
          </div>

          <h2 className="text-[26px] font-bold text-ink-secondary tracking-tight">Sign in</h2>
          <p className="text-[14px] text-ink-mute mt-1 mb-6">Choose your role and enter your employee ID.</p>

          <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#e9eef2] mb-6">
            {Object.entries(MODES).map(([key, m]) => {
              const Icon = m.icon;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMode(key)}
                  className={`h-9 flex items-center justify-center gap-1.5 rounded-md text-[13px] font-semibold transition ${
                    mode === key ? "bg-white text-primary shadow-sm" : "text-[#5b6b78] hover:text-ink-secondary"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {m.label}
                </button>
              );
            })}
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-[13px] font-semibold text-ink-secondary mb-1.5" htmlFor="employee-id">
                Employee ID
              </label>
              <div className="relative">
                <IdCard className="w-4 h-4 text-ink-mute absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="employee-id"
                  className={field}
                  placeholder={active.placeholder}
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-ink-secondary mb-1.5" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-ink-mute absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className={`${field} pr-10`}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded text-ink-mute hover:text-primary"
                  onClick={() => setShowPassword((s) => !s)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-[13px] text-[#b91c1c] bg-[#fdf2f2] border border-[#f8d4d4] rounded-md px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 mt-2 rounded-md bg-primary hover:bg-primary-press text-white text-[14.5px] font-semibold flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-60"
            >
              {loading ? "Signing in…" : active.cta}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <p className="mt-6 text-[12px] text-ink-mute text-center">
            Demo login: <span className="font-mono text-[#46525c]">{active.demo}</span>
          </p>
        </div>
      </main>
    </div>
  );
}
