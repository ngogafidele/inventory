// Generates an outstanding-balance statement PDF for a branch customer.
import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { Sale } from "@/lib/db/models/Sale"
import "@/lib/db/models/User"
import { requireAuth } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { getKigaliDateParts } from "@/lib/utils/time"
import { STORE_ADDRESSES } from "@/lib/utils/constants"
import { generateOutstandingCustomerPDF } from "@/lib/pdf/outstanding-generator"

export const runtime = "nodejs"

type PopulatedSaleUser = {
  _id: { toString(): string }
  name?: string
  email?: string
}

type OutstandingSale = {
  _id: { toString(): string }
  createdAt?: Date
  totalAmount: number
  items: Array<{
    name: string
    unit?: string
    quantity: number
    basePrice?: number
    sellingPrice?: number
    lineTotal?: number
  }>
  outstanding?: {
    customerName: string
    customerPhone?: string
    paymentDate?: Date
  }
  createdBy?: PopulatedSaleUser | { toString(): string }
}

function isPopulatedSaleUser(
  value: OutstandingSale["createdBy"]
): value is PopulatedSaleUser {
  return typeof value === "object" && value !== null && "_id" in value
}

function pad2(value: number) {
  return String(value).padStart(2, "0")
}

function buildStatementNumber(date = new Date()) {
  const parts = getKigaliDateParts(date)
  const dateStamp = `${parts.year}${pad2(parts.month)}${pad2(parts.day)}`
  const random = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")
  return `LOAN-${dateStamp}-${random}`
}

function slugifyCustomerName(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 32)
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
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

    const customerName = request.nextUrl.searchParams
      .get("customerName")
      ?.trim()
    if (!customerName) {
      return NextResponse.json(
        { success: false, error: "Customer name is required." },
        { status: 400 }
      )
    }

    const customerPhone = request.nextUrl.searchParams
      .get("customerPhone")
      ?.trim()

    const nameRegex = new RegExp(`^${escapeRegex(customerName)}$`, "i")
    const query: Record<string, unknown> = {
      store,
      paymentStatus: "unpaid",
      "outstanding.customerName": nameRegex,
    }

    if (customerPhone) {
      query["outstanding.customerPhone"] = customerPhone
    }

    await connectToDatabase()
    const sales = await Sale.find(query)
      .populate("createdBy", "name email")
      .sort({ "outstanding.paymentDate": 1, createdAt: -1 })
      .lean<OutstandingSale[]>()

    if (sales.length === 0) {
      return NextResponse.json(
        { success: false, error: "No outstanding sales found." },
        { status: 404 }
      )
    }

    const statementNumber = buildStatementNumber()
    // Build rows so that each item in a sale gets its own row in the PDF table.
    // This ensures multiple items with the same sale/payment date appear on
    // separate lines rather than being concatenated into a single row.
    const rows: Array<{
      saleDate?: Date
      paymentDate?: Date
      items: string
      pricePerUnit: number | null
      recordedBy: string
      amount: number
    }> = []

    for (const sale of sales) {
      const recordedBy = isPopulatedSaleUser(sale.createdBy)
        ? sale.createdBy.name ?? sale.createdBy.email ?? "Unknown User"
        : "Unknown User"

      if (!sale.items || sale.items.length === 0) {
        rows.push({
          saleDate: sale.createdAt,
          paymentDate: sale.outstanding?.paymentDate,
          items: "-",
          pricePerUnit: null,
          recordedBy,
          amount: sale.totalAmount,
        })
        continue
      }

      for (const item of sale.items) {
        const itemText = `${item.name} (${item.quantity} ${item.unit ?? "pcs"})`
        rows.push({
          saleDate: sale.createdAt,
          paymentDate: sale.outstanding?.paymentDate,
          items: itemText,
          pricePerUnit: item.sellingPrice ?? item.basePrice ?? null,
          recordedBy,
          amount: item.lineTotal ?? 0,
        })
      }
    }

    const totalOutstanding = sales.reduce(
      (sum, sale) => sum + sale.totalAmount,
      0
    )

    const pdf = await generateOutstandingCustomerPDF(
      {
        statementNumber,
        generatedAt: new Date(),
        customerName,
        customerPhone: customerPhone || undefined,
        rows,
        totalOutstanding,
      },
      { name: "B Ikaze Hardware", address: STORE_ADDRESSES[store] }
    )

    const slug = slugifyCustomerName(customerName) || "customer"
    const filename = `${statementNumber}-${slug}.pdf`

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("[Outstanding PDF Error]", error)
    const detail =
      process.env.NODE_ENV !== "production" && error instanceof Error
        ? `: ${error.message}`
        : ""
    return NextResponse.json(
      { success: false, error: `Failed to generate statement PDF${detail}` },
      { status: 500 }
    )
  }
}
