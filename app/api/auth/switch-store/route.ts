import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/middleware"
import {
  AUTH_COOKIE,
  createToken,
  updateCurrentStore,
  type StoreKey,
} from "@/lib/auth/session"

export async function POST(request: NextRequest) {
  try {
    const { authorized, session } = await requireAuth(request)
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { store } = (await request.json()) as { store?: StoreKey }
    if (!store || !["store1", "store2"].includes(store)) {
      return NextResponse.json(
        { success: false, error: "Invalid store" },
        { status: 400 }
      )
    }

    const updatedSession = updateCurrentStore(session, store)
    const token = createToken(updatedSession)

    const response = NextResponse.json({ success: true, store })
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
      { success: false, error: "Failed to switch store" },
      { status: 400 }
    )
  }
}
