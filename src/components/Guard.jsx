"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/AuthContext";
import Layout from "./Layout";

const HOME_BY_ROLE = { receiver: "/delivery", creator: "/lrs/new" };
export const homeFor = (role) => HOME_BY_ROLE[role] || "/";

// Client-side gate, same as the old PrivateRoute. The API still enforces roles on every request.
export default function Guard({ roles, bare = false, children }) {
  const { user, ready, logout } = useAuth();
  const router = useRouter();
  const allowed = !!user && (!roles || roles.includes(user.role));

  useEffect(() => {
    if (!ready) return;
    // Old Security sessions: that role no longer has any screens.
    if (user?.role === "security") {
      logout();
      return;
    }
    if (!user) router.replace("/login");
    else if (!allowed) router.replace(homeFor(user.role));
  }, [ready, user, allowed, router, logout]);

  if (!ready || !allowed) return null;
  const page = <Suspense fallback={null}>{children}</Suspense>;
  return bare ? page : <Layout>{page}</Layout>;
}
