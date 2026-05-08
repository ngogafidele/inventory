import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { User } from "@/lib/db/models/User"
import {
  pruneOldLoginLogs,
  UserLoginLog,
} from "@/lib/db/models/UserLoginLog"
import { LoginSchema } from "@/lib/db/validators/user"
import { comparePassword } from "@/lib/auth/hash"
import {
  AUTH_COOKIE,
  createToken,
  getAuthCookieOptions,
  type AuthSession,
} from "@/lib/auth/session"
import { ZodError } from "zod"

export async function POST(request: NextRequest) {
  try {
    const bodyData = await request.json()
    const body = LoginSchema.parse(bodyData)
    await connectToDatabase()

    const user = await User.findOne({ email: body.email.toLowerCase() })
    if (!user || !user.isActive) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      )
    }

    const isValid = await comparePassword(body.password, user.password)
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      )
    }

    const loginAt = new Date()
    user.lastLogin = loginAt
    await user.save()

    const loginLog = await UserLoginLog.create({
      userId: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      loginAt,
    })
    await pruneOldLoginLogs()

    const stores = user.stores as AuthSession["stores"]
    const session: AuthSession = {
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      role: user.role,
      stores,
      currentStore: stores[0],
      loginLogId: loginLog._id.toString(),
      lastActivityAt: Date.now(),
    }

    const token = createToken(session)
    const response = NextResponse.json({
      success: true,
      data: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        isAdmin: user.isAdmin,
        stores,
        currentStore: session.currentStore,
      },
    })

    response.cookies.set(AUTH_COOKIE, token, getAuthCookieOptions(session))

    return response
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to login"
    console.error("[Login Error]", errorMessage)

    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 400 }
      )
    }

    const normalizedMessage = errorMessage.toLowerCase()
    const isNetworkError =
      normalizedMessage.includes("querysrv etimeout") ||
      normalizedMessage.includes("enotfound") ||
      normalizedMessage.includes("econnrefused") ||
      normalizedMessage.includes("network")

    if (isNetworkError) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Network problem. We cannot reach the database right now. Please try again.",
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: "Login failed. Please try again.",
      },
      { status: 400 }
    )
  }
}
