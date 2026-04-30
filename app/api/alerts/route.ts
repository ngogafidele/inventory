import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { Alert } from "@/lib/db/models/Alert"
import { requireAdmin } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { CreateAlertSchema } from "@/lib/db/validators/alert"

export async function GET(request: NextRequest) {
  try {
    const { authorized, session } = await requireAuth(request)
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const store = resolveStoreFromRequest(request, session)
    if (!store) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      )
    }

    const resolved = request.nextUrl.searchParams.get("resolved")
    const isResolved = resolved === "true" ? true : resolved === "false" ? false : undefined

    await connectToDatabase()

    const filter: Record<string, unknown> = { store }
    if (typeof isResolved === "boolean") {
      filter.isResolved = isResolved
    }

    const alerts = await Alert.find(filter).sort({ createdAt: -1 })

    return NextResponse.json({ success: true, data: alerts })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch alerts" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { authorized, session } = await requireAdmin(request)
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: "Admin only" },
        { status: 403 }
      )
    }

    const store = resolveStoreFromRequest(request, session)
    if (!store) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      )
    }

    const payload = CreateAlertSchema.parse(await request.json())
    if (payload.type === "low-stock") {
      return NextResponse.json(
        { success: false, error: "Low stock alerts are system generated" },
        { status: 400 }
      )
    }

    await connectToDatabase()
    const alert = await Alert.create({
      ...payload,
      store,
      isResolved: false,
    })

    return NextResponse.json({ success: true, data: alert }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to create alert" },
      { status: 400 }
    )
  }
}
