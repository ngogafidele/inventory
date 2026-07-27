// Re-verifies the signed-in user's password to open the sensitive pages.
import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { User } from "@/lib/db/models/User"
import { comparePassword } from "@/lib/auth/hash"
import { requireAuth } from "@/lib/auth/middleware"
import {
  AUTH_COOKIE,
  createToken,
  getAuthCookieOptions,
  refreshSessionActivity,
} from "@/lib/auth/session"
import { ReauthSchema } from "@/lib/db/validators/user"
import { ZodError } from "zod"

export async function POST(request: NextRequest) {
  try {
    const { authorized, session } = await requireAuth(request)
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: "Session expired" },
        { status: 401 }
      )
    }

    const body = ReauthSchema.parse(await request.json())
    await connectToDatabase()

    const user = await User.findById(session.userId).select("password")
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Session expired" },
        { status: 401 }
      )
    }

    const isValid = await comparePassword(body.password, user.password)
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: "Incorrect password" },
        { status: 401 }
      )
    }

    // The proof rides on the session token, so every later request is checked
    // server-side rather than trusting the client to remember it passed.
    const verified = refreshSessionActivity({ ...session, reauthAt: Date.now() })

    const response = NextResponse.json({ success: true })
    response.cookies.set(
      AUTH_COOKIE,
      createToken(verified),
      getAuthCookieOptions(verified)
    )
    return response
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: "Enter your password" },
        { status: 400 }
      )
    }

    console.error("[Reauth Error]", error)
    return NextResponse.json(
      { success: false, error: "Verification failed. Please try again." },
      { status: 400 }
    )
  }
}
