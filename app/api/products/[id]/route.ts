import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { ReturnModel } from "@/lib/db/models/Return"
import { Sale } from "@/lib/db/models/Sale"
import { StockAdjustment } from "@/lib/db/models/StockAdjustment"
import { requireAdmin, requireAuth } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { UpdateProductSchema } from "@/lib/db/validators/product"
import { syncLowStockAlert } from "@/lib/db/alerts"
import { ZodError } from "zod"

const CASE_INSENSITIVE_COLLATION = { locale: "en", strength: 2 } as const

function isDuplicateProductNameError(error: unknown) {
  if (typeof error !== "object" || error === null) return false

  const mongoError = error as {
    code?: unknown
    keyPattern?: Record<string, unknown>
  }

  return mongoError.code === 11000 && Boolean(mongoError.keyPattern?.name)
}

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
    const product = await Product.findOne({ _id: id, store })

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: product })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch product" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, session } = await requireAdmin(request)
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: "Admin only" },
        { status: 403 }
      )
    }

    const { id } = await context.params
    const store = resolveStoreFromRequest(request, session)
    if (!store) {
      return NextResponse.json(
        { success: false, error: "Invalid store" },
        { status: 400 }
      )
    }

    const payload = UpdateProductSchema.parse(await request.json())
    const { categoryId: _categoryId, ...updateInput } = payload

    await connectToDatabase()

    if (payload.name) {
      const duplicateProduct = await Product.exists({
        _id: { $ne: id },
        store,
        name: payload.name,
      }).collation(CASE_INSENSITIVE_COLLATION)

      if (duplicateProduct) {
        return NextResponse.json(
          { success: false, error: "A product with this name already exists." },
          { status: 409 }
        )
      }
    }

    const product = await Product.findOneAndUpdate(
      { _id: id, store },
      updateInput,
      { returnDocument: "after", runValidators: true }
    )

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      )
    }

    await syncLowStockAlert({
      store,
      productId: product._id.toString(),
      name: product.name,
      sku: product.sku,
      quantity: product.quantity,
      threshold: product.lowStockThreshold ?? 0,
    })

    return NextResponse.json({ success: true, data: product })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }
    if (isDuplicateProductNameError(error)) {
      return NextResponse.json(
        { success: false, error: "A product with this name already exists." },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { success: false, error: "Failed to update product" },
      { status: 400 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, session } = await requireAdmin(request)
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: "Admin only" },
        { status: 403 }
      )
    }

    const { id } = await context.params
    const store = resolveStoreFromRequest(request, session)

    if (!store) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      )
    }

    await connectToDatabase()

    const [saleReference, returnReference, adjustmentReference] =
      await Promise.all([
        Sale.exists({ store, "items.productId": id }),
        ReturnModel.exists({
          store,
          $or: [
            { "returnItems.productId": id },
            { "replacementItems.productId": id },
          ],
        }),
        StockAdjustment.exists({ store, productId: id }),
      ])

    if (saleReference || returnReference || adjustmentReference) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This product is referenced by sales, returns, or stock history and cannot be deleted.",
        },
        { status: 409 }
      )
    }

    const product = await Product.findOneAndDelete({ _id: id, store })

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to delete product" },
      { status: 400 }
    )
  }
}
