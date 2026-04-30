import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { Category } from "@/lib/db/models/Category"
import { requireAdmin, requireAuth } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { CreateProductSchema } from "@/lib/db/validators/product"
import { syncLowStockAlert } from "@/lib/db/alerts"

function getSkuBase(name: string) {
  const normalized = name.toUpperCase().replace(/[^A-Z0-9]+/g, "")
  return (normalized.slice(0, 6) || "PRD").padEnd(3, "X")
}

async function generateProductSku(store: string, name: string) {
  const base = getSkuBase(name)

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
    const sku = `${base}-${suffix}`
    const existing = await Product.exists({ store, sku })
    if (!existing) return sku
  }

  return `${base}-${Date.now().toString(36).toUpperCase()}`
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
    const products = await Product.find({ store }).populate("categoryId")

    return NextResponse.json({ success: true, data: products })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch products" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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

    const payload = CreateProductSchema.parse(await request.json())

    await connectToDatabase()

    const category = await Category.findOne({ _id: payload.categoryId, store })
    if (!category) {
      return NextResponse.json(
        { success: false, error: "Category not found" },
        { status: 404 }
      )
    }

    const product = await Product.create({
      ...payload,
      sku: await generateProductSku(store, payload.name),
      store,
    })

    await syncLowStockAlert({
      store,
      productId: product._id.toString(),
      name: product.name,
      sku: product.sku,
      quantity: product.quantity,
      threshold: product.lowStockThreshold ?? 0,
    })

    return NextResponse.json(
      { success: true, data: product },
      { status: 201 }
    )
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to create product" },
      { status: 400 }
    )
  }
}
