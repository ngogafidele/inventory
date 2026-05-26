// Generates a product catalog PDF using the selected branch identity.
import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { requireAuth } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { getKigaliDateParts } from "@/lib/utils/time"
import { STORE_ADDRESSES } from "@/lib/utils/constants"
import { generateProductCatalogPDF } from "@/lib/pdf/product-catalog-generator"

export const runtime = "nodejs"

type CatalogProduct = {
  name: string
  sku: string
  unit?: string
  quantity: number
  lowStockThreshold?: number
  costPrice: number
  price: number
}

function pad2(value: number) {
  return String(value).padStart(2, "0")
}

function buildCatalogFilename(date = new Date()) {
  const parts = getKigaliDateParts(date)
  return `products-catalog-${parts.year}${pad2(parts.month)}${pad2(
    parts.day
  )}.pdf`
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
    const products = await Product.find({ store })
      .sort({ name: 1 })
      .lean<CatalogProduct[]>()

    const pdf = await generateProductCatalogPDF(
      {
        generatedAt: new Date(),
        products: products.map((product) => ({
          name: product.name,
          sku: product.sku,
          unit: product.unit ?? "pcs",
          quantity: product.quantity,
          lowStockThreshold: product.lowStockThreshold ?? 0,
          costPrice: product.costPrice ?? 0,
          price: product.price,
        })),
      },
      { name: "B Ikaze Hardware", address: STORE_ADDRESSES[store] }
    )

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${buildCatalogFilename()}"`,
      },
    })
  } catch (error) {
    console.error("[Products Catalog PDF Error]", error)
    const detail =
      process.env.NODE_ENV !== "production" && error instanceof Error
        ? `: ${error.message}`
        : ""
    return NextResponse.json(
      {
        success: false,
        error: `Failed to generate products catalog PDF${detail}`,
      },
      { status: 500 }
    )
  }
}
