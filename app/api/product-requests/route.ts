// Lets any store user propose a new product for an admin to approve.
import { NextRequest, NextResponse } from "next/server"
import { z, ZodError } from "zod"
import { Product } from "@/lib/db/models/Product"
import { ProductEditSchema, productEditSnapshot, sameProductEdit } from "@/lib/product-edit"
import { objectIdSchema } from "@/lib/db/validators/shared"
import { connectToDatabase } from "@/lib/db/connection"
import { ProductRequest } from "@/lib/db/models/ProductRequest"
import { requireAuth } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { CreateProductSchema } from "@/lib/db/validators/product"
import {
  checkPackUnitsAllowed,
  ProductInputError,
  productNameExists,
} from "@/lib/db/products"
import {
  loadProductRequests,
  pendingRequestNameExists,
  serializeProductRequest,
} from "@/lib/db/product-requests"

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
    const requests = await loadProductRequests({
      store,
      isAdmin: session.isAdmin,
      userId: session.userId,
    })

    return NextResponse.json({ success: true, data: requests })
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to fetch product requests" },
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

    const input = await request.json()
    if (input.kind === "edit") {
      const edit = z.object({ kind: z.literal("edit"), productId: objectIdSchema, original: ProductEditSchema, changes: ProductEditSchema }).strict().parse(input)
      checkPackUnitsAllowed(store, edit.changes)
      await connectToDatabase()
      const product = await Product.findOne({ _id: edit.productId, store })
      if (!product) throw new ProductInputError("Product not found.", 404)
      const original = productEditSnapshot(product)
      if (!sameProductEdit(original, edit.original)) throw new ProductInputError("Product details changed. Reload the page and submit again.", 409)
      if (sameProductEdit(original, edit.changes)) throw new ProductInputError("Change at least one product detail.", 400)
      if (await productNameExists(store, edit.changes.name, edit.productId)) throw new ProductInputError("A product with this name already exists.", 409)
      const created = await ProductRequest.create({ ...edit.changes, kind: "edit", productId: product._id, original, quantity: 0, store, submittedBy: session.userId })
      return NextResponse.json({ success: true, data: serializeProductRequest(created.toObject(), session.name) }, { status: 201 })
    }
    const payload = CreateProductSchema.parse(input)
    const { categoryId: _categoryId, ...requestInput } = payload
    checkPackUnitsAllowed(store, payload)

    await connectToDatabase()

    // Caught here so nobody waits on a review that could only fail. Approval
    // checks the name again, since a product may be added in the meantime.
    if (await productNameExists(store, payload.name)) {
      throw new ProductInputError("A product with this name already exists.", 409)
    }
    if (await pendingRequestNameExists(store, payload.name)) {
      throw new ProductInputError(
        "A product with this name is already awaiting approval.",
        409
      )
    }

    const created = await ProductRequest.create({
      ...requestInput,
      store,
      status: "pending",
      submittedBy: session.userId,
    })

    return NextResponse.json(
      {
        success: true,
        data: serializeProductRequest(created.toObject(), session.name),
      },
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
    return NextResponse.json(
      { success: false, error: "Failed to submit product" },
      { status: 400 }
    )
  }
}
