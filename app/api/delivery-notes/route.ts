// Lists and creates branch delivery notes from selected sales.
import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import { connectToDatabase } from "@/lib/db/connection"
import { DeliveryNote } from "@/lib/db/models/DeliveryNote"
import { Sale } from "@/lib/db/models/Sale"
import { requireAuth } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { CreateDeliveryNoteSchema } from "@/lib/db/validators/delivery-note"
import { generateDeliveryNoteNumber } from "@/lib/utils/number-generator"

const MAX_DELIVERY_NOTE_NUMBER_ATTEMPTS = 5

function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  )
}

function formatValidationError(error: unknown, fallback: string) {
  if (!(error instanceof ZodError)) return fallback

  return (
    error.issues
      .map((issue) => {
        const field = issue.path.join(".")
        return field ? `${field}: ${issue.message}` : issue.message
      })
      .join("; ") || "Invalid input"
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
    const deliveryNotes = await DeliveryNote.find({ store }).sort({
      issuedAt: -1,
      createdAt: -1,
    })

    return NextResponse.json({ success: true, data: deliveryNotes })
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to fetch delivery notes" },
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

    const store = resolveStoreFromRequest(request, session)
    if (!store) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      )
    }

    const payload = CreateDeliveryNoteSchema.parse(await request.json())
    await connectToDatabase()

    const sales = await Sale.find({
      _id: { $in: payload.saleIds },
      store,
      deletedAt: null,
    })

    if (sales.length !== payload.saleIds.length) {
      return NextResponse.json(
        { success: false, error: "One or more sales were not found" },
        { status: 404 }
      )
    }

    const items = sales.flatMap((sale) =>
      sale.items.map((item) => ({
        description: item.name,
        sku: item.sku,
        unit: item.unit ?? "pcs",
        quantity: item.quantity,
      }))
    )

    let deliveryNote = null
    for (
      let attempt = 0;
      attempt < MAX_DELIVERY_NOTE_NUMBER_ATTEMPTS;
      attempt += 1
    ) {
      try {
        deliveryNote = await DeliveryNote.create({
          store,
          saleIds: payload.saleIds,
          deliveryNoteNumber: await generateDeliveryNoteNumber(store),
          customerName: payload.customerName,
          customerLocation: payload.customerLocation,
          deliveryLocation: payload.deliveryLocation,
          deliveryDate: new Date(payload.deliveryDate),
          deliveredByName: payload.deliveredByName,
          deliveredByPhone: payload.deliveredByPhone ?? "",
          deliveredByDate: new Date(payload.deliveredByDate),
          items,
          issuedAt: new Date(),
        })
        break
      } catch (error) {
        if (!isDuplicateKeyError(error)) {
          throw error
        }
      }
    }

    if (!deliveryNote) {
      return NextResponse.json(
        { success: false, error: "Failed to generate delivery note number" },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { success: true, data: deliveryNote },
      { status: 201 }
    )
  } catch (error) {
    const message = formatValidationError(
      error,
      "Failed to create delivery note"
    )
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
