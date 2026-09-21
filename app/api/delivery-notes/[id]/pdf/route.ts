// Generates a printable delivery note PDF for the selected branch.
import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { requireAuth } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { DeliveryNote } from "@/lib/db/models/DeliveryNote"
import { generateDeliveryNotePDF } from "@/lib/pdf/invoice-generator"
import { STORE_ADDRESSES } from "@/lib/utils/constants"

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
    const deliveryNote = await DeliveryNote.findOne({ _id: id, store })

    if (!deliveryNote) {
      return NextResponse.json(
        { success: false, error: "Delivery note not found" },
        { status: 404 }
      )
    }

    const pdf = await generateDeliveryNotePDF(
      {
        number: deliveryNote.deliveryNoteNumber,
        customerName: deliveryNote.customerName,
        customerLocation: deliveryNote.customerLocation,
        deliveryLocation: deliveryNote.deliveryLocation,
        deliveryDate: deliveryNote.deliveryDate,
        deliveredByName: deliveryNote.deliveredByName,
        deliveredByPhone: deliveryNote.deliveredByPhone ?? "",
        deliveredByDate: deliveryNote.deliveredByDate,
        items: deliveryNote.items.map((item) => ({
          description: item.description,
          sku: item.sku ?? "",
          unit: item.unit ?? "pcs",
          quantity: item.quantity,
        })),
      },
      { name: "B Ikaze Hardware", address: STORE_ADDRESSES[store] }
    )

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${deliveryNote.deliveryNoteNumber}.pdf"`,
      },
    })
  } catch (error) {
    console.error("[Delivery Note PDF Error]", error)
    const detail =
      process.env.NODE_ENV !== "production" && error instanceof Error
        ? `: ${error.message}`
        : ""
    return NextResponse.json(
      { success: false, error: `Failed to generate delivery note PDF${detail}` },
      { status: 500 }
    )
  }
}
