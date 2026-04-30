import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { User } from "@/lib/db/models/User"
import { requireAdmin } from "@/lib/auth/middleware"
import { CreateUserSchema } from "@/lib/db/validators/user"
import { hashPassword } from "@/lib/auth/hash"
import { isStoreKey } from "@/lib/auth/session"

export async function GET(request: NextRequest) {
  try {
    const { authorized } = await requireAdmin(request)
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: "Admin only" },
        { status: 403 }
      )
    }

    await connectToDatabase()

    const store = request.nextUrl.searchParams.get("store")
    const filter = isStoreKey(store)
      ? { stores: { $in: [store] } }
      : {}

    const users = await User.find(filter).select("-password")

    return NextResponse.json({ success: true, data: users })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch users" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { authorized } = await requireAdmin(request)
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: "Admin only" },
        { status: 403 }
      )
    }

    const body = CreateUserSchema.parse(await request.json())

    if (body.role === "admin") {
      return NextResponse.json(
        { success: false, error: "Only one admin is allowed" },
        { status: 400 }
      )
    }

    await connectToDatabase()

    const hashedPassword = await hashPassword(body.password)
    const user = await User.create({
      name: body.name,
      email: body.email.toLowerCase(),
      password: hashedPassword,
      role: body.role,
      stores: body.stores,
      isActive: body.isActive ?? true,
      isAdmin: false,
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          stores: user.stores,
          isActive: user.isActive,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to create user" },
      { status: 400 }
    )
  }
}
