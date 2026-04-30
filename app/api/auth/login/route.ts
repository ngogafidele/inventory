import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { User } from "@/lib/db/models/User"
import { UserLoginLog } from "@/lib/db/models/UserLoginLog"
import { LoginSchema } from "@/lib/db/validators/user"
import { comparePassword } from "@/lib/auth/hash"
import {
  AUTH_COOKIE,
  createToken,
  type AuthSession,
} from "@/lib/auth/session"

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

    const session: AuthSession = {
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      role: user.role,
      stores: user.stores,
      currentStore: user.stores[0],
      loginLogId: loginLog._id.toString(),
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
        stores: user.stores,
        currentStore: session.currentStore,
      },
    })

    response.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    })

    return response
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to login"
    console.error("[Login Error]", errorMessage)
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 400 }
    )
  }
}
