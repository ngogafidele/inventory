// Loads and shapes product requests for the products screen.
import type { StoreKey } from "@/lib/utils/constants"
import { formatInKigali } from "@/lib/utils/time"
import type { PackUnit } from "@/lib/utils/units"
import { ProductRequest } from "@/lib/db/models/ProductRequest"
import { CASE_INSENSITIVE_COLLATION } from "@/lib/db/products"

// Rejected requests stay visible to whoever submitted them for this long, so
// they can read the reason and resubmit.
const REJECTED_VISIBLE_DAYS = 30

export type ProductRequestStatus = "pending" | "approved" | "rejected"

export type ProductRequestClient = {
  _id: string
  status: ProductRequestStatus
  name: string
  unit: string
  packUnits: PackUnit[]
  costUnit?: string
  quantity: number
  openingUnit?: string
  lowStockThreshold: number
  costPrice: number
  price: number
  supplierName?: string
  supplierPhone?: string
  submittedByName: string
  createdAtLabel: string
  rejectionReason?: string
}

type ProductRequestRecord = {
  _id: { toString(): string }
  status: ProductRequestStatus
  name: string
  unit: string
  packUnits?: PackUnit[] | null
  costUnit?: string | null
  quantity: number
  openingUnit?: string | null
  lowStockThreshold?: number | null
  costPrice: number
  price: number
  supplierName?: string | null
  supplierPhone?: string | null
  submittedBy?: { name?: string } | { toString(): string } | null
  createdAt?: Date
  rejectionReason?: string | null
}

export function serializeProductRequest(
  record: ProductRequestRecord,
  submittedByName?: string
): ProductRequestClient {
  const populatedName =
    record.submittedBy && "name" in record.submittedBy
      ? record.submittedBy.name
      : undefined
  return {
    _id: record._id.toString(),
    status: record.status,
    name: record.name,
    unit: record.unit,
    // Read field by field: a Mongoose subdocument spreads its internals.
    packUnits: (record.packUnits ?? []).map((pack) => ({
      name: pack.name,
      factor: pack.factor,
      price: pack.price,
    })),
    costUnit: record.costUnit ?? undefined,
    quantity: record.quantity,
    openingUnit: record.openingUnit ?? undefined,
    lowStockThreshold: record.lowStockThreshold ?? 0,
    costPrice: record.costPrice,
    price: record.price,
    supplierName: record.supplierName || undefined,
    supplierPhone: record.supplierPhone || undefined,
    submittedByName: submittedByName ?? populatedName ?? "-",
    createdAtLabel: formatInKigali(record.createdAt, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }),
    rejectionReason: record.rejectionReason || undefined,
  }
}

// Admins review every pending request in the store. Other users follow their
// own: pending ones, and recent rejections with the reason.
export async function loadProductRequests(params: {
  store: StoreKey
  isAdmin: boolean
  userId: string
}) {
  const { store, isAdmin, userId } = params
  const rejectedSince = new Date(
    Date.now() - REJECTED_VISIBLE_DAYS * 24 * 60 * 60 * 1000
  )
  const filter = isAdmin
    ? { store, status: "pending" }
    : {
        store,
        submittedBy: userId,
        $or: [
          { status: "pending" },
          { status: "rejected", reviewedAt: { $gte: rejectedSince } },
        ],
      }

  const records = await ProductRequest.find(filter)
    .sort({ createdAt: -1 })
    .populate("submittedBy", "name")
    .lean<ProductRequestRecord[]>()

  return records.map((record) => serializeProductRequest(record))
}

export async function pendingRequestNameExists(
  store: StoreKey,
  name: string,
  excludeId?: string
) {
  const existing = await ProductRequest.exists({
    store,
    status: "pending",
    name,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).collation(CASE_INSENSITIVE_COLLATION)
  return Boolean(existing)
}
