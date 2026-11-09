import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/jwt";

const AUTH_PAGES = new Set(["/login", "/signup"]);

/**
 * Route protection. Runs on page routes only (see matcher). Unauthenticated
 * users are redirected to /login (remembering where they were headed), and
 * already-authenticated users are kept off the login/signup pages.
 *
 * This is a convenience redirect layer, not the security boundary: every
 * private resource is independently guarded server-side via requireUser /
 * getOwned* in its route handler or server component.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const claims = await verifySessionToken(token);
  const isAuthPage = AUTH_PAGES.has(pathname);

  if (!claims && !isAuthPage) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (claims && isAuthPage) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except API routes, Next internals, and static files.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
