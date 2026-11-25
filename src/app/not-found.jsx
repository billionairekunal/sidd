"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Unknown URLs go home, as before (the Guard then sends each role to its own start page).
export default function NotFound() {
  const router = useRouter();
  useEffect(() => router.replace("/"), [router]);
  return null;
}
