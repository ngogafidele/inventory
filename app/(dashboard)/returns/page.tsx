import "@/lib/db/models/User"
import { connectToDatabase } from "@/lib/db/connection"
import { ReturnModel } from "@/lib/db/models/Return"
import { Product } from "@/lib/db/models/Product"
import { ReturnsManager } from "@/components/returns/returns-manager"
import { getCurrentStore, requireServerSession } from "@/lib/auth/server"
import { formatInKigali } from "@/lib/utils/time"

type PopulatedUser = {
  _id: { toString(): string }
  name?: string
  email?: string
}

type ReturnPageReturn = {
  _id: { toString(): string }
  returnItems: Array<{
    productId: { toString(): string }
    name: string
    sku: string
    unit?: string
    quantity: number
    unitPrice: number
    lineTotal: number
  }>
  replacementItems: Array<{
    productId: { toString(): string }
    name: string
    sku: string
    unit?: string
    quantity: number
    unitPrice: number
    lineTotal: number
  }>
  totalReturnAmount: number
  totalReplacementAmount: number
  notes?: string
  createdBy?: PopulatedUser | { toString(): string }
  createdAt?: Date
}

type ReturnPageProduct = {
  _id: { toString(): string }
  name: string
  sku: string
  unit?: string
  quantity: number
  price: number
}

function isPopulatedUser(value: ReturnPageReturn["createdBy"]): value is PopulatedUser {
  return typeof value === "object" && value !== null && "_id" in value
}

export default async function ReturnsPage() {
  const session = await requireServerSession()
  const store = getCurrentStore(session)

  await connectToDatabase()
  const [returns, products] = await Promise.all([
    ReturnModel.find({ store })
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .lean<ReturnPageReturn[]>(),
    Product.find({ store }).sort({ name: 1 }).lean<ReturnPageProduct[]>(),
  ])

  const serializedReturns = returns.map((entry) => ({
    _id: entry._id.toString(),
    returnItems: (entry.returnItems ?? []).map((item) => ({
      productId: item.productId.toString(),
      name: item.name,
      sku: item.sku,
      unit: item.unit ?? "pcs",
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
    replacementItems: (entry.replacementItems ?? []).map((item) => ({
      productId: item.productId.toString(),
      name: item.name,
      sku: item.sku,
      unit: item.unit ?? "pcs",
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
    totalReturnAmount: entry.totalReturnAmount,
    totalReplacementAmount: entry.totalReplacementAmount,
    notes: entry.notes ?? "",
    createdByName: isPopulatedUser(entry.createdBy)
      ? entry.createdBy.name ?? entry.createdBy.email ?? "Unknown User"
      : "Unknown User",
    createdAt: entry.createdAt?.toISOString(),
    createdAtLabel: entry.createdAt
      ? formatInKigali(entry.createdAt, {
          year: "numeric",
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      : "-",
  }))

  const serializedProducts = products.map((product) => ({
    _id: product._id.toString(),
    name: product.name,
    sku: product.sku,
    unit: product.unit ?? "pcs",
    quantity: product.quantity,
    price: product.price,
  }))

  return (
    <ReturnsManager
      initialReturns={serializedReturns}
      products={serializedProducts}
      currentUserLabel={session.email}
    />
  )
}
