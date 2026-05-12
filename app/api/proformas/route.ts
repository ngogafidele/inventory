import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { requireAuth } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { Proforma } from "@/lib/db/models/Proforma"
import { Sale } from "@/lib/db/models/Sale"
import {
  CreateProformaSchema,
  ProformaListQuerySchema,
} from "@/lib/db/validators/proforma"
import { generateProformaNumber } from "@/lib/utils/number-generator"
import { ZodError } from "zod"

const MAX_PROFORMA_NUMBER_ATTEMPTS = 5

function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  )
}

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

    const query = ProformaListQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries())
    )
    const filter: Record<string, unknown> = { storeId: store }

    if (query.search) {
      const search = new RegExp(query.search, "i")
      filter.$or = [
        { proformaNumber: search },
        { customerName: search },
        { customerEmail: search },
      ]
    }

    if (query.dateFrom || query.dateTo) {
      filter.issuedAt = {
        ...(query.dateFrom ? { $gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { $lte: new Date(query.dateTo) } : {}),
      }
    }

    await connectToDatabase()
    const skip = (query.page - 1) * query.limit
    const [proformas, total] = await Promise.all([
      Proforma.find(filter)
        .sort({ issuedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(query.limit),
      Proforma.countDocuments(filter),
    ])

    return NextResponse.json({
      success: true,
      data: proformas,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pageCount: Math.max(1, Math.ceil(total / query.limit)),
      },
    })
  } catch (error) {
    const message =
      error instanceof ZodError
        ? error.issues[0]?.message ?? "Invalid query"
        : "Failed to fetch proformas"
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { authorized, session } = await requireAuth(request)
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    if (!session.isAdmin && session.role === "staff") {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
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

    const payload = CreateProformaSchema.parse(await request.json())
    await connectToDatabase()

    const sale = payload.saleId
      ? await Sale.findOne({ _id: payload.saleId, store })
      : null

    if (payload.saleId && !sale) {
      return NextResponse.json(
        { success: false, error: "Sale not found" },
        { status: 404 }
      )
    }

    const inputItems =
      payload.items ??
      sale?.items.map((item) => ({
        description: item.name,
        unit: item.unit ?? "pcs",
        quantity: item.quantity,
        unitPrice: item.sellingPrice,
      })) ??
      []

    const items = inputItems.map((item) => {
      const lineTotal = item.quantity * item.unitPrice
      return {
        description: item.description,
        unit: item.unit ?? "pcs",
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal,
      }
    })
    const totalAmount = items.reduce((sum, item) => sum + item.lineTotal, 0)

    let proforma = null
    for (let attempt = 0; attempt < MAX_PROFORMA_NUMBER_ATTEMPTS; attempt += 1) {
      try {
        proforma = await Proforma.create({
          storeId: store,
          saleId: payload.saleId,
          proformaNumber: await generateProformaNumber(store),
          customerName: payload.customerName,
          customerEmail: payload.customerEmail ?? "",
          customerPhone: payload.customerPhone ?? "",
          items,
          totalAmount,
          issuedAt: new Date(),
          expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : undefined,
        })
        break
      } catch (error) {
        if (!isDuplicateKeyError(error)) {
          throw error
        }
      }
    }

    if (!proforma) {
      return NextResponse.json(
        { success: false, error: "Failed to generate proforma number" },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { success: true, data: proforma },
      { status: 201 }
    )
  } catch (error) {
    const message =
      error instanceof ZodError
        ? error.issues
            .map((issue) => {
              const field = issue.path.join(".")
              return field ? `${field}: ${issue.message}` : issue.message
            })
            .join("; ") || "Invalid input"
        : "Failed to create proforma"
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
