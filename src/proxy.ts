import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/config";

// Webhooks (/api/webhooks/*) are intentionally not protected; they verify signatures instead.
const PROTECTED = /^\/(dashboard|admin)(\/|$)/;

// Signed-in students live in the app, not on the marketing pages.
const APP_HOME: Record<string, string> = { "/": "/dashboard", "/pricing": "/dashboard/plans" };

export default async function proxy(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  // Refreshes an expiring session and writes the new cookies onto both the request and the response.
  const supabase = createServerClient(supabaseUrl(), supabaseKey(), {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll(list) {
        for (const { name, value } of list) req.cookies.set(name, value);
        res = NextResponse.next({ request: req });
        for (const { name, value, options } of list) res.cookies.set(name, value, options);
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const redirectTo = (pathname: string, search = "") => {
    const url = req.nextUrl.clone();
    url.pathname = pathname;
    url.search = search;
    const redirect = NextResponse.redirect(url);
    for (const cookie of res.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  };

  const { pathname, search } = req.nextUrl;
  if (!user && PROTECTED.test(pathname)) {
    return redirectTo("/sign-in", `?redirect_url=${encodeURIComponent(pathname + search)}`);
  }
  if (user && APP_HOME[pathname]) return redirectTo(APP_HOME[pathname]);
  return res;
}

export const config = {
  matcher: [
    // Pages only: skip Next.js internals, static files and API routes (they check the session themselves).
    "/((?!_next|api|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
