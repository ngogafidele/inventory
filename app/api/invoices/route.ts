import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { Invoice } from "@/lib/db/models/Invoice"
import { Sale } from "@/lib/db/models/Sale"
import { requireAuth } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { CreateInvoiceSchema } from "@/lib/db/validators/invoice"
import { generateInvoiceNumber } from "@/lib/utils/invoice"

const MAX_INVOICE_NUMBER_ATTEMPTS = 5

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

    await connectToDatabase()
    const invoices = await Invoice.find({ store }).sort({ issuedAt: -1 })

    return NextResponse.json({ success: true, data: invoices })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch invoices" },
      { status: 500 }
    )
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

    const payload = CreateInvoiceSchema.parse(await request.json())

    await connectToDatabase()

    const sale = await Sale.findOne({ _id: payload.saleId, store })
    if (!sale) {
      return NextResponse.json(
        { success: false, error: "Sale not found" },
        { status: 404 }
      )
    }

    const existingInvoice = await Invoice.findOne({ saleId: sale._id, store })
    if (existingInvoice) {
      return NextResponse.json(
        { success: false, error: "Invoice already exists" },
        { status: 400 }
      )
    }

    let invoice = null
    for (let attempt = 0; attempt < MAX_INVOICE_NUMBER_ATTEMPTS; attempt += 1) {
      try {
        invoice = await Invoice.create({
          store,
          saleId: sale._id,
          invoiceNumber: generateInvoiceNumber(),
          customerName: payload.customerName,
          customerEmail: payload.customerEmail ?? "",
          customerPhone: payload.customerPhone ?? "",
          totalAmount: sale.totalAmount,
          status: payload.status ?? "unpaid",
          issuedAt: new Date(),
          dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
        })
        break
      } catch (error) {
        if (!isDuplicateKeyError(error)) {
          throw error
        }

        const duplicateInvoice = await Invoice.findOne({
          saleId: sale._id,
          store,
        })
        if (duplicateInvoice) {
          return NextResponse.json(
            { success: false, error: "Invoice already exists" },
            { status: 400 }
          )
        }
      }
    }

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: "Failed to generate invoice number" },
        { status: 409 }
      )
    }

    return NextResponse.json({ success: true, data: invoice }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to create invoice" },
      { status: 400 }
    )
  }
}
