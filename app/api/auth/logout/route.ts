import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { User } from "@/lib/db/models/User"
import { UserLoginLog } from "@/lib/db/models/UserLoginLog"
import { AUTH_COOKIE, getSessionFromRequest } from "@/lib/auth/session"

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request)
  if (session) {
    try {
      await connectToDatabase()
      const logoutAt = new Date()
      await User.findByIdAndUpdate(session.userId, { lastLogout: logoutAt })
      if (session.loginLogId) {
        await UserLoginLog.findByIdAndUpdate(session.loginLogId, { logoutAt })
      } else {
        await UserLoginLog.findOneAndUpdate(
          { userId: session.userId, logoutAt: { $exists: false } },
          { logoutAt },
          { sort: { loginAt: -1 } }
        )
      }
    } catch (error) {
      console.error("[Logout Error]", error)
    }
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
