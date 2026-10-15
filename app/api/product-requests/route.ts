// Lets any store user propose a new product for an admin to approve.
import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
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

    const payload = CreateProductSchema.parse(await request.json())
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
