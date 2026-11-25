"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/AuthContext";
import Layout from "./Layout";

const HOME_BY_ROLE = { security: "/gate", receiver: "/delivery" };
export const homeFor = (role) => HOME_BY_ROLE[role] || "/";

// Client-side gate, same as the old PrivateRoute. The API still enforces roles on every request.
export default function Guard({ roles, bare = false, children }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const allowed = !!user && (!roles || roles.includes(user.role));

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/login");
    else if (!allowed) router.replace(homeFor(user.role));
  }, [ready, user, allowed, router]);

  if (!ready || !allowed) return null;
  const page = <Suspense fallback={null}>{children}</Suspense>;
  return bare ? page : <Layout>{page}</Layout>;
}
