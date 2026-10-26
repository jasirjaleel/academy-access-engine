import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Webhooks (/api/webhooks/*) are intentionally not protected; they verify signatures instead.
const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/admin(.*)"]);

// Signed-in students live in the app, not on the marketing pages.
const APP_HOME: Record<string, string> = { "/": "/dashboard", "/pricing": "/dashboard/plans" };

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
    return;
  }
  const target = APP_HOME[req.nextUrl.pathname];
  if (target) {
    const { userId } = await auth();
    if (userId) {
      const url = req.nextUrl.clone();
      url.pathname = target;
      return NextResponse.redirect(url);
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
