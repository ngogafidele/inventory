import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { requireAuth } from "@/lib/auth/middleware"
import { User } from "@/lib/db/models/User"

export async function GET(request: NextRequest) {
  try {
    const { authorized, session } = await requireAuth(request)
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    await connectToDatabase()
    const user = await User.findById(session.userId).select("-password")

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        ...user.toObject(),
        currentStore: session.currentStore ?? session.stores[0],
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch session" },
      { status: 500 }
    )
  }
}
