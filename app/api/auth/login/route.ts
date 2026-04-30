import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { User } from "@/lib/db/models/User"
import { LoginSchema } from "@/lib/db/validators/user"
import { comparePassword } from "@/lib/auth/hash"
import {
  AUTH_COOKIE,
  createToken,
  type AuthSession,
} from "@/lib/auth/session"

export async function POST(request: NextRequest) {
  try {
    const body = LoginSchema.parse(await request.json())
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

    user.lastLogin = new Date()
    await user.save()

    const session: AuthSession = {
      userId: user._id.toString(),
      email: user.email,
      isAdmin: user.isAdmin,
      role: user.role,
      stores: user.stores,
      currentStore: user.stores[0],
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
    return NextResponse.json(
      { success: false, error: "Failed to login" },
      { status: 400 }
    )
  }
}
