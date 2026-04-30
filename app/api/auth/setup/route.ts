import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { User } from "@/lib/db/models/User"
import { UserLoginLog } from "@/lib/db/models/UserLoginLog"
import { SetupAdminSchema } from "@/lib/db/validators/user"
import { hashPassword } from "@/lib/auth/hash"
import { AUTH_COOKIE, createToken, type AuthSession } from "@/lib/auth/session"

export async function POST(request: NextRequest) {
  try {
    const body = SetupAdminSchema.parse(await request.json())

    await connectToDatabase()

    const existingAdmin = await User.findOne({ isAdmin: true })
    if (existingAdmin) {
      return NextResponse.json(
        { success: false, error: "Admin already exists" },
        { status: 400 }
      )
    }

    const hashedPassword = await hashPassword(body.password)

    const loginAt = new Date()
    const admin = await User.create({
      name: body.name,
      email: body.email,
      password: hashedPassword,
      isAdmin: true,
      role: "admin",
      stores: ["store1", "store2"],
      isActive: true,
      lastLogin: loginAt,
    })

    const loginLog = await UserLoginLog.create({
      userId: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      loginAt,
    })

    const session: AuthSession = {
      userId: admin._id.toString(),
      name: admin.name,
      email: admin.email,
      isAdmin: true,
      role: "admin",
      stores: ["store1", "store2"],
      currentStore: "store1",
      loginLogId: loginLog._id.toString(),
    }

    const token = createToken(session)
    const response = NextResponse.json({
      success: true,
      data: {
        id: admin._id.toString(),
        name: admin.name,
        email: admin.email,
        role: admin.role,
        isAdmin: admin.isAdmin,
        stores: admin.stores,
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
      { success: false, error: "Failed to setup admin" },
      { status: 400 }
    )
  }
}
