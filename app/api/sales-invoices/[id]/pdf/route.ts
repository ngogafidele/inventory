import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { requireAuth } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { Invoice } from "@/lib/db/models/Invoice"
import { Sale } from "@/lib/db/models/Sale"
import { generateSalesInvoicePDF } from "@/lib/pdf/invoice-generator"

export const runtime = "nodejs"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

    const { id } = await context.params
    await connectToDatabase()
    const invoice = await Invoice.findOne({ _id: id, store })

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: "Invoice not found" },
        { status: 404 }
      )
    }

    let items = (invoice.items ?? []).map((item) => ({
      description: item.description,
      sku: item.sku ?? "",
      unit: item.unit ?? "pcs",
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    }))

    if (items.length === 0 && invoice.saleId) {
      const sale = await Sale.findOne({ _id: invoice.saleId, store })
      items =
        sale?.items.map((item) => ({
          description: item.name,
          sku: item.sku,
          unit: item.unit ?? "pcs",
          quantity: item.quantity,
          unitPrice: item.sellingPrice,
          lineTotal: item.lineTotal,
        })) ?? []
    }

    const pdf = await generateSalesInvoicePDF(
      {
        number: invoice.invoiceNumber,
        date: invoice.issuedAt,
        customerName: invoice.customerName,
        customerEmail: invoice.customerEmail ?? "",
        customerPhone: invoice.customerPhone ?? "",
        status: invoice.status,
        totalAmount: invoice.totalAmount,
        items,
      },
      { name: "B Ikaze Hardware", address: "Kigali, Gisozi" }
    )

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      },
    })
  } catch (error) {
    console.error("[Sales Invoice PDF Error]", error)
    const detail =
      process.env.NODE_ENV !== "production" && error instanceof Error
        ? `: ${error.message}`
        : ""
    return NextResponse.json(
      { success: false, error: `Failed to generate invoice PDF${detail}` },
      { status: 500 }
    )
  }
}
