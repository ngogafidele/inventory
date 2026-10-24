import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { connectToDatabase } from "@/lib/db/connection"
import { ProductRequest } from "@/lib/db/models/ProductRequest"
import "@/lib/db/models/User"
import { formatInKigali } from "@/lib/utils/time"
import type { ProductRequestNotification } from "@/types/product-request-notification"

type RequestRow = {
  _id: { toString(): string }
  name: string
  kind?: "create" | "edit"
  submittedBy?: { name?: string } | null
  createdAt?: Date
}

export async function GET(request: NextRequest) {
  try {
    const { authorized, session } = await requireAdmin(request)
    if (!authorized || !session) {
      return NextResponse.json({ success: false, error: "Admin only" }, { status: 403 })
    }
    const store = resolveStoreFromRequest(request, session)
    if (!store) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
    }
    await connectToDatabase()
    const requests = await ProductRequest.find({ store, status: "pending" })
      .select("name kind submittedBy createdAt")
      .sort({ createdAt: -1 })
      .populate("submittedBy", "name")
      .lean<RequestRow[]>()
    const data: ProductRequestNotification[] = requests.map((item) => ({
      id: item._id.toString(),
      name: item.name,
      kind: item.kind ?? "create",
      submittedByName: item.submittedBy?.name ?? "Unknown user",
      createdAtLabel: formatInKigali(item.createdAt, {
        year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
      }),
    }))
    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json({ success: false, error: "Failed to fetch approval notifications" }, { status: 500 })
  }
}
