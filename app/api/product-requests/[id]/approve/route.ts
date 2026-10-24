// Approves a product request, creating the product an admin has confirmed.
import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import { connectToDatabase } from "@/lib/db/connection"
import { ProductRequest } from "@/lib/db/models/ProductRequest"
import { Product } from "@/lib/db/models/Product"
import { ProductEditSchema, productEditSnapshot, sameProductEdit } from "@/lib/product-edit"
import { requireAdmin } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { CreateProductSchema } from "@/lib/db/validators/product"
import { syncLowStockAlert } from "@/lib/db/alerts"
import {
  createProduct,
  checkPackUnitsAllowed,
  productNameExists,
  isDuplicateProductNameError,
  ProductInputError,
} from "@/lib/db/products"

export async function POST(
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

    const store = resolveStoreFromRequest(request, session)
    if (!store) {
      return NextResponse.json(
        { success: false, error: "Invalid store" },
        { status: 400 }
      )
    }

    const { id } = await context.params
    // The admin may correct the proposal before approving, so the product is
    // created from what the review form sends, not the stored request.
    const input = await request.json()

    const db = await connectToDatabase()

    let product
    const dbSession = await db.startSession()
    try {
      product = await dbSession.withTransaction(async () => {
        // Claimed in the same transaction as the create: two admins approving
        // at once make one product, and a failed create leaves it pending.
        const claimed = await ProductRequest.findOneAndUpdate(
          { _id: id, store, status: "pending" },
          {
            status: "approved",
            reviewedBy: session.userId,
            reviewedAt: new Date(),
          },
          { session: dbSession, returnDocument: "after" }
        )
        if (!claimed) {
          throw new ProductInputError(
            "This request was already reviewed or withdrawn.",
            409
          )
        }

        if (claimed.kind === "edit") {
          const changes = ProductEditSchema.parse(input)
          checkPackUnitsAllowed(store, changes)
          const current = await Product.findOne({ _id: claimed.productId, store }).session(dbSession)
          if (!current) throw new ProductInputError("Product no longer exists.", 404)
          const original = ProductEditSchema.parse(claimed.original)
          if (!sameProductEdit(productEditSnapshot(current), original)) {
            throw new ProductInputError("Product details changed since submission. Reject this request and ask for a new one.", 409)
          }
          if (await productNameExists(store, changes.name, current._id.toString())) throw new ProductInputError("A product with this name already exists.", 409)
          const updated = await Product.findOneAndUpdate(
            { _id: current._id, store }, { $set: changes },
            { session: dbSession, returnDocument: "after", runValidators: true }
          )
          await ProductRequest.updateOne({ _id: claimed._id }, { $set: { approvedChanges: changes } }, { session: dbSession })
          return updated
        }
        const payload = CreateProductSchema.parse(input)
        const created = await createProduct({
          store,
          input: payload,
          userId: session.userId,
          session: dbSession,
        })

        await ProductRequest.updateOne(
          { _id: claimed._id },
          { productId: created._id },
          { session: dbSession }
        )

        return created
      })
    } finally {
      await dbSession.endSession()
    }

    if (!product) {
      throw new Error("Failed to approve product")
    }

    try {
      await syncLowStockAlert({
        store,
        productId: product._id.toString(),
        name: product.name,
        sku: product.sku,
        quantity: product.quantity,
        threshold: product.lowStockThreshold ?? 0,
      })
    } catch (error) {
      console.error("[Low Stock Alert Sync Error]", error)
    }

    return NextResponse.json(
      { success: true, data: product },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof ProductInputError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      )
    }
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
      { success: false, error: "Failed to approve product" },
      { status: 400 }
    )
  }
}
