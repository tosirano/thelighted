import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Routes that require authentication
const PROTECTED_PREFIX = "/admin";

// Routes that are always public — never intercepted
const PUBLIC_PREFIXES = [
  "/api/",
  "/_next/",
  "/menu",
  "/login",
  "/register",
  "/favicon.ico",
];

// Role hierarchy: a role can access its own level and below
const ROLE_HIERARCHY: Record<string, number> = {
  super_admin: 3,
  admin: 2,
  staff: 1,
  user: 0,
};

// Route-to-minimum-role mapping. More specific paths take priority.
const ROUTE_ROLE_MAP: Array<{ prefix: string; minRole: string }> = [
  { prefix: "/admin/users", minRole: "admin" },
  { prefix: "/admin/settings", minRole: "super_admin" },
  { prefix: "/admin/billing", minRole: "super_admin" },
  { prefix: "/admin", minRole: "staff" },
];

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return new TextEncoder().encode(secret);
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function requiredRoleForPath(pathname: string): string | null {
  for (const entry of ROUTE_ROLE_MAP) {
    if (pathname.startsWith(entry.prefix)) return entry.minRole;
  }
  return null;
}

function hasRole(userRole: string, requiredRole: string): boolean {
  return (ROLE_HIERARCHY[userRole] ?? -1) >= (ROLE_HIERARCHY[requiredRole] ?? 999);
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Skip public routes immediately
  if (isPublicRoute(pathname)) return NextResponse.next();

  // Only intercept admin routes
  if (!pathname.startsWith(PROTECTED_PREFIX)) return NextResponse.next();

  const token = request.cookies.get("accessToken")?.value;

  if (!token) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const { payload } = await jwtVerify(token, getSecret());

    const userRole = (payload.role as string) ?? "user";
    const requiredRole = requiredRoleForPath(pathname);

    if (requiredRole && !hasRole(userRole, requiredRole)) {
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = "/admin/dashboard";
      dashboardUrl.search = "";
      return NextResponse.redirect(dashboardUrl);
    }

    return NextResponse.next();
  } catch {
    // Token is expired or invalid — redirect to login
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirect", pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete("accessToken");
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image  (image optimisation)
     * - favicon.ico
     * - public assets (png, jpg, svg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)).*)",
  ],
};