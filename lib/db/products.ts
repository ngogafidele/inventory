// Creates catalog products, shared by direct admin entry and request approval.
import type { ClientSession } from "mongoose"
import type { z } from "zod"
import { findUnitOption, roundCost, roundMoney } from "@/lib/utils/units"
import { storeUsesPackUnits, type StoreKey } from "@/lib/utils/constants"
import { Product } from "@/lib/db/models/Product"
import { ProductReceipt } from "@/lib/db/models/ProductReceipt"
import type { CreateProductSchema } from "@/lib/db/validators/product"

export type CreateProductInput = z.infer<typeof CreateProductSchema>

export const CASE_INSENSITIVE_COLLATION = { locale: "en", strength: 2 } as const

// A rule the input broke; the message is safe to show the user.
export class ProductInputError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message)
  }
}

export function isDuplicateProductNameError(error: unknown) {
  if (typeof error !== "object" || error === null) return false

  const mongoError = error as {
    code?: unknown
    keyPattern?: Record<string, unknown>
  }

  return mongoError.code === 11000 && Boolean(mongoError.keyPattern?.name)
}

function getSkuBase(name: string) {
  const normalized = name.toUpperCase().replace(/[^A-Z0-9]+/g, "")
  return (normalized.slice(0, 6) || "PRD").padEnd(3, "X")
}

async function generateProductSku(store: StoreKey, name: string) {
  const base = getSkuBase(name)

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
    const sku = `${base}-${suffix}`
    const existing = await Product.exists({ store, sku })
    if (!existing) return sku
  }

  return `${base}-${Date.now().toString(36).toUpperCase()}`
}

// Package units are a per-store feature; other stores sell in the base unit
// only.
export function checkPackUnitsAllowed(
  store: StoreKey,
  input: Pick<CreateProductInput, "packUnits">
) {
  if (!storeUsesPackUnits(store) && input.packUnits.length > 0) {
    throw new ProductInputError("This store does not use package units.")
  }
}

export async function productNameExists(store: StoreKey, name: string, excludeId?: string) {
  const existing = await Product.exists({ store, name, ...(excludeId ? { _id: { $ne: excludeId } } : {}) }).collation(
    CASE_INSENSITIVE_COLLATION
  )
  return Boolean(existing)
}

// Creates the product and, when a supplier is given with opening stock, its
// opening receipt. The low-stock alert is left to the caller, after any
// transaction it passes in has committed.
export async function createProduct(params: {
  store: StoreKey
  input: CreateProductInput
  userId: string
  session?: ClientSession
}) {
  const { store, input, userId, session } = params
  const {
    categoryId: _categoryId,
    supplierName,
    supplierPhone,
    openingUnit,
    ...productInput
  } = input

  checkPackUnitsAllowed(store, input)

  if (await productNameExists(store, input.name)) {
    throw new ProductInputError("A product with this name already exists.", 409)
  }

  const [product] = await Product.create(
    [
      {
        ...productInput,
        sku: await generateProductSku(store, input.name),
        store,
      },
    ],
    { session }
  )

  if (supplierName && supplierPhone && product.quantity > 0) {
    // Recorded in the unit the stock was counted in (10 crates at 12,000)
    // when that is a whole number of it; otherwise in the base unit.
    const counted = findUnitOption(product, openingUnit) ?? findUnitOption(product)
    const unit =
      counted && product.quantity % counted.factor === 0
        ? counted
        : findUnitOption(product)
    const factor = unit?.factor ?? 1
    await ProductReceipt.create(
      [
        {
          store,
          productId: product._id,
          sku: product.sku,
          supplierName,
          supplierPhone,
          unit: unit?.name ?? product.unit,
          unitFactor: factor,
          baseQuantity: product.quantity,
          quantity: product.quantity / factor,
          unitCost: roundCost(product.costPrice * factor),
          totalCost: roundMoney(product.quantity * product.costPrice),
          receivedAt: new Date(),
          receivedBy: userId,
        },
      ],
      { session }
    )
  }

  return product
}
