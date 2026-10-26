"use client";

import { useAuth } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const APP_HOME: Record<string, string> = { "/": "/dashboard", "/pricing": "/dashboard/plans" };

/**
 * Backup for the proxy redirect: if the server saw an expired session token (Clerk refreshes it
 * in the browser), send a signed-in student into the app as soon as Clerk confirms the session.
 */
export function SignedInRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    const target = APP_HOME[pathname];
    if (isLoaded && isSignedIn && target) router.replace(target);
  }, [isLoaded, isSignedIn, pathname, router]);
  return null;
}
