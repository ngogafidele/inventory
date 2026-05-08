import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/auth/middleware"
import {
  AUTH_COOKIE,
  createToken,
  getAuthCookieOptions,
  refreshSessionActivity,
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
    if (!session.isAdmin) {
      return NextResponse.json(
        { success: false, error: "Admin only" },
        { status: 403 }
      )
    }

    const { store } = (await request.json()) as { store?: StoreKey }
    if (!store || !["store1", "store2"].includes(store)) {
      return NextResponse.json(
        { success: false, error: "Invalid store" },
        { status: 400 }
      )
    }

    const allowedStores: StoreKey[] = session.isAdmin
      ? ["store1", "store2"]
      : session.stores

    if (!allowedStores.includes(store)) {
      return NextResponse.json(
        { success: false, error: "You do not have access to this store" },
        { status: 403 }
      )
    }

    const updatedSession = refreshSessionActivity(
      updateCurrentStore({ ...session, stores: [...allowedStores] }, store)
    )
    const token = createToken(updatedSession)

    const response = NextResponse.json({ success: true, store })
    response.cookies.set(
      AUTH_COOKIE,
      token,
      getAuthCookieOptions(updatedSession)
    )

    revalidatePath("/", "layout")

    return response
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to switch store"
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    )
  }
}
