// Turns submitted sale lines into stored sale items with unit snapshots.
import type { Types } from "mongoose"
import {
  findUnitOption,
  getBaseUnit,
  roundCost,
  roundMoney,
  toBaseQuantity,
  type PackUnit,
} from "@/lib/utils/units"

export type SaleLineInput = {
  productId: string
  unit?: string
  quantity: number
  sellingPrice: number
  costPrice?: number
}

export type SaleLineProduct = {
  _id: Types.ObjectId | { toString(): string }
  name: string
  sku: string
  unit?: string | null
  packUnits?: PackUnit[] | null
  price: number
  costPrice?: number | null
}

export class SaleLineError extends Error {}

// Builds the stored lines and the stock each product needs, in base units.
// Throws SaleLineError with a message safe to show the user.
//
// sellingPrice and costPrice arrive per unit sold. basePrice is stored per unit
// sold too (cost per base unit x the unit's factor) so basePrice x quantity is
// the line's cost of goods, which is what every report multiplies.
export function buildSaleItems(
  lines: SaleLineInput[],
  products: Map<string, SaleLineProduct>,
  options: { allowCostOverride: boolean }
) {
  const baseQuantities = new Map<string, number>()
  let totalAmount = 0

  const items = lines.map((line) => {
    const product = products.get(line.productId)
    if (!product) {
      throw new SaleLineError("One or more products not found")
    }

    const unit = findUnitOption(product, line.unit)
    if (!unit) {
      throw new SaleLineError(
        `${product.name} is not sold by "${line.unit}".`
      )
    }

    const baseQuantity = toBaseQuantity(line.quantity, unit.factor)
    if (baseQuantity === null) {
      const baseUnit = getBaseUnit(product)
      throw new SaleLineError(
        `${line.quantity} ${unit.name} of ${product.name} is not a whole number of ${baseUnit}.`
      )
    }

    const lineTotal = roundMoney(line.sellingPrice * line.quantity)
    totalAmount += lineTotal

    const requestedCostPrice =
      options.allowCostOverride && Number.isFinite(line.costPrice)
        ? line.costPrice
        : undefined
    const baseCost = product.costPrice ?? product.price

    baseQuantities.set(
      line.productId,
      (baseQuantities.get(line.productId) ?? 0) + baseQuantity
    )

    return {
      productId: product._id,
      name: product.name,
      sku: product.sku,
      unit: unit.name,
      quantity: line.quantity,
      unitFactor: unit.factor,
      baseQuantity,
      baseUnit: getBaseUnit(product),
      basePrice: requestedCostPrice ?? roundCost(baseCost * unit.factor),
      sellingPrice: line.sellingPrice,
      lineTotal,
    }
  })

  return { items, baseQuantities, totalAmount: roundMoney(totalAmount) }
}
