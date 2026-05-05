import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { User } from "@/lib/db/models/User"
import { requireAdmin } from "@/lib/auth/middleware"
import { UpdateUserSchema } from "@/lib/db/validators/user"
import { hashPassword } from "@/lib/auth/hash"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized } = await requireAdmin(request)
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: "Admin only" },
        { status: 403 }
      )
    }

    const { id } = await context.params

    await connectToDatabase()
    const user = await User.findById(id).select("-password")

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: user })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch user" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized } = await requireAdmin(request)
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: "Admin only" },
        { status: 403 }
      )
    }

    const { id } = await context.params
    const body = UpdateUserSchema.parse(await request.json())

    if (body.role === "admin") {
      return NextResponse.json(
        { success: false, error: "Only one admin is allowed" },
        { status: 400 }
      )
    }

    await connectToDatabase()

    if (body.password) {
      body.password = await hashPassword(body.password)
    }

    if (body.email) {
      body.email = body.email.toLowerCase()
    }

    if (body.stores) {
      body.stores = [body.stores]
    }

    const user = await User.findByIdAndUpdate(id, body, {
      returnDocument: "after",
      runValidators: true,
    }).select("-password")

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: user })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to update user" },
      { status: 400 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized } = await requireAdmin(request)
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: "Admin only" },
        { status: 403 }
      )
    }

    const { id } = await context.params

    await connectToDatabase()
    const user = await User.findById(id)

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      )
    }

    if (user.isAdmin) {
      return NextResponse.json(
        { success: false, error: "Cannot delete admin" },
        { status: 400 }
      )
    }

    await user.deleteOne()

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to delete user" },
      { status: 400 }
    )
  }
}
