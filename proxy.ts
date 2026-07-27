// Refreshes authenticated sessions and expires invalid access at request time.
import { NextResponse, type NextRequest } from "next/server"
import {
  AUTH_COOKIE,
  createToken,
  getAuthCookieOptions,
  readLapsedSession,
  refreshSessionActivity,
  verifyToken,
  type AuthSession,
} from "@/lib/auth/session"
import { isStrictPath } from "@/lib/auth/idle"
import {
  isReauthCurrent,
  requiresReauth,
  VERIFY_PATH,
} from "@/lib/auth/reauth"
import { getCurrentUserSession } from "@/lib/auth/current-user"
import { recordLogout } from "@/lib/auth/logout-log"

const PUBLIC_PATHS = ["/", "/reset-password", "/setup-admin"]
const LOGOUT_PATH = "/api/auth/logout"
const HEARTBEAT_PATH = "/api/auth/heartbeat"

// These handlers mint or clear the auth cookie themselves. If the proxy set
// one too, the response would carry two Set-Cookie headers for the same name
// and the winner would come down to merge order — which would silently drop a
// just-granted reauth. Leave the cookie to the handler on these routes.
const SELF_ISSUING_PATHS = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/reauth",
  "/api/auth/switch-store",
]

function matchesPath(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`)
}

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => matchesPath(pathname, path))
}

// Link prefetching fires background requests for routes the user has not
// opened, so their pathnames must never be mistaken for a navigation.
function isPrefetchRequest(request: NextRequest) {
  return (
    request.headers.has("next-router-prefetch") ||
    request.headers.has("next-router-segment-prefetch") ||
    request.headers.get("sec-purpose")?.includes("prefetch") === true
  )
}

function clearAuthCookie(response: NextResponse) {
  response.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  })
}

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE)?.value
  if (!token) {
    return NextResponse.next()
  }

  const pathname = request.nextUrl.pathname
  const tokenSession = verifyToken(token)

  // The heartbeat only restamps the idle clock and returns no data, so it can
  // skip the user lookup that every other request pays for. Nothing is granted
  // on the strength of that skip: any request that actually returns something
  // still revalidates the user below, and rejects a deactivated one there.
  let session: AuthSession | null = null
  if (tokenSession) {
    session = matchesPath(pathname, HEARTBEAT_PATH)
      ? tokenSession
      : await getCurrentUserSession(tokenSession)
  }

  if (!session) {
    // Logout owns its own recording and cookie clearing, so let it run.
    if (matchesPath(pathname, LOGOUT_PATH)) {
      return NextResponse.next()
    }

    // Close the audit row here rather than waiting for the client to report
    // it. By the time the idle guard notices, the cookie is usually already
    // gone — cleared by this very branch on an earlier request, or expired by
    // its own maxAge — so a client-driven logout call would arrive with no
    // token and no way to say who it belonged to. This is the last moment the
    // token is in hand. The write is guarded, so repeats are no-ops.
    const lapsed = tokenSession ?? readLapsedSession(token)
    if (lapsed) {
      await recordLogout(lapsed)
    }

    const response = pathname.startsWith("/api/")
      ? NextResponse.json(
          { success: false, error: "Session expired" },
          { status: 401 }
        )
      : isPublicPath(pathname)
        ? NextResponse.next()
        : NextResponse.redirect(new URL("/", request.url))

    clearAuthCookie(response)
    return response
  }

  // Step-up gate. Enforced here rather than inside the two pages so that a
  // prefetch, an RSC navigation, and a direct call to the data endpoints are
  // all covered by the same check — gating only the pages would leave the
  // same figures readable from /api/dashboard and /api/reports.
  if (requiresReauth(pathname) && !isReauthCurrent(session)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: "Verification required" },
        { status: 401 }
      )
    }

    const verifyUrl = new URL(VERIFY_PATH, request.url)
    verifyUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(verifyUrl)
  }

  if (SELF_ISSUING_PATHS.some((path) => matchesPath(pathname, path))) {
    return NextResponse.next()
  }

  // Only a real page navigation re-decides strictness. Data fetches and
  // prefetches carry the flag through untouched, so the sidebar prefetching
  // /sales cannot quietly widen the idle window back to the relaxed timeout
  // while /reports is still open — nor can prefetching /reports narrow it for
  // someone who never opened that page.
  const carryStrictThrough =
    pathname.startsWith("/api/") || isPrefetchRequest(request)
  const strict = carryStrictThrough
    ? Boolean(session.strict)
    : isStrictPath(pathname)

  const refreshedSession = refreshSessionActivity({ ...session, strict })
  const response = NextResponse.next()
  response.cookies.set(
    AUTH_COOKIE,
    createToken(refreshedSession),
    getAuthCookieOptions(refreshedSession)
  )
  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
