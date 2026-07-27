// Ends an authenticated session and records logout activity.
import { NextRequest, NextResponse } from "next/server"
import {
  AUTH_COOKIE,
  getLapsedSessionFromRequest,
  getSessionFromRequest,
} from "@/lib/auth/session"
import { recordLogout } from "@/lib/auth/logout-log"

export async function POST(request: NextRequest) {
  // The lapsed fallback covers a user who clicks sign out just after the idle
  // window closed. If the proxy already recorded it, the guarded write in
  // recordLogout makes this a no-op.
  const session =
    getSessionFromRequest(request) ?? getLapsedSessionFromRequest(request)
  if (session) {
    await recordLogout(session)
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  })
  return response
}
