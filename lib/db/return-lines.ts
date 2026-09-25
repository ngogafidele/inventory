// Matches returned items to the sale lines they reverse, per product and unit.
//
// A sale can hold the same product in two units (a crate and some loose
// bottles), so returns are capped per product-and-unit line, in the unit it
// was sold in. Stock is restored in base units using the sale line's own
// factor, so a later change to the product's crate size cannot distort it.
import {
  lineBaseQuantity,
  normalizeUnitName,
  toBaseQuantity,
} from "@/lib/utils/units"

type SaleLine = {
  productId: { toString(): string }
  name: string
  sku: string
  unit?: string | null
  quantity: number
  unitFactor?: number | null
  baseUnit?: string | null
  basePrice: number
}

type ReturnedLine = {
  productId: { toString(): string }
  unit?: string | null
  quantity: number
}

export type SoldLine = {
  productId: string
  name: string
  sku: string
  unit: string
  unitFactor: number
  baseUnit: string
  // Cost per unit sold, so report gross profit stays consistent.
  basePrice: number
  soldQuantity: number
}

export class ReturnLineError extends Error {}

export function lineKey(productId: string, unit: string | null | undefined) {
  return `${productId}|${normalizeUnitName(unit || "pcs")}`
}

export function getSoldLines(items: SaleLine[]) {
  const sold = new Map<string, SoldLine>()
  items.forEach((item) => {
    const productId = item.productId.toString()
    const unit = item.unit || "pcs"
    const key = lineKey(productId, unit)
    const existing = sold.get(key)
    if (existing) {
      existing.soldQuantity += item.quantity
      return
    }
    sold.set(key, {
      productId,
      name: item.name,
      sku: item.sku,
      unit,
      unitFactor: item.unitFactor ?? 1,
      baseUnit: item.baseUnit || unit,
      basePrice: item.basePrice,
      soldQuantity: item.quantity,
    })
  })
  return sold
}

// Quantities already returned per sale line, in the unit sold.
export function getReturnedByLine(returns: Array<{ returnItems: ReturnedLine[] }>) {
  const returned = new Map<string, number>()
  returns.forEach((entry) => {
    entry.returnItems.forEach((item) => {
      const key = lineKey(item.productId.toString(), item.unit)
      returned.set(key, (returned.get(key) ?? 0) + item.quantity)
    })
  })
  return returned
}

// Picks the sale line a returned item reverses. Without a unit, a product
// sold in exactly one unit on this sale is unambiguous.
export function resolveSoldLine(
  sold: Map<string, SoldLine>,
  productId: string,
  unit?: string
) {
  if (unit) return sold.get(lineKey(productId, unit)) ?? null
  const matches = Array.from(sold.values()).filter(
    (line) => line.productId === productId
  )
  if (matches.length > 1) {
    throw new ReturnLineError(
      `${matches[0].name} was sold in more than one unit on this sale; choose which one is being returned.`
    )
  }
  return matches[0] ?? null
}

type ReturnInput = { productId: string; unit?: string; quantity: number; unitPrice: number }

// Builds return items against a sale, enforcing that no line is returned
// beyond what it sold (after `otherReturned`).
export function buildSaleReturnItems(
  inputs: ReturnInput[],
  sold: Map<string, SoldLine>,
  otherReturned: Map<string, number>
) {
  const requested = new Map<string, { line: SoldLine; quantity: number }>()
  const resolved = inputs.map((input) => {
    const line = resolveSoldLine(sold, input.productId, input.unit)
    if (!line) {
      throw new ReturnLineError("A returned item was not part of the selected sale.")
    }
    const key = lineKey(line.productId, line.unit)
    const entry = requested.get(key) ?? { line, quantity: 0 }
    entry.quantity += input.quantity
    requested.set(key, entry)
    return { input, line }
  })

  for (const [key, { line, quantity }] of requested.entries()) {
    const remaining = line.soldQuantity - (otherReturned.get(key) ?? 0)
    if (quantity > remaining + 1e-9) {
      throw new ReturnLineError(
        `Cannot return more than was sold for ${line.name}. ${Math.max(0, remaining)} ${line.unit} remaining.`
      )
    }
  }

  let totalReturnAmount = 0
  const items = resolved.map(({ input, line }) => {
    const baseQuantity = toBaseQuantity(input.quantity, line.unitFactor)
    if (baseQuantity === null) {
      throw new ReturnLineError(
        `${input.quantity} ${line.unit} of ${line.name} is not a whole number of ${line.baseUnit}.`
      )
    }
    const lineTotal = Math.round(input.unitPrice * input.quantity * 100) / 100
    totalReturnAmount += lineTotal
    return {
      productId: line.productId,
      name: line.name,
      sku: line.sku,
      unit: line.unit,
      quantity: input.quantity,
      unitFactor: line.unitFactor,
      baseQuantity,
      baseUnit: line.baseUnit,
      basePrice: line.basePrice,
      unitPrice: input.unitPrice,
      lineTotal,
    }
  })

  return {
    items,
    totalReturnAmount: Math.round(totalReturnAmount * 100) / 100,
  }
}

// Net stock effect of return lines in base units: returned goods come back,
// legacy replacement goods went out.
export function getReturnStockEffect(entry: {
  returnItems: Array<ReturnedLine & { unitFactor?: number | null; baseQuantity?: number | null }>
  replacementItems?: Array<ReturnedLine & { unitFactor?: number | null; baseQuantity?: number | null }>
}) {
  const effect = new Map<string, number>()
  const add = (productId: string, change: number) =>
    effect.set(productId, (effect.get(productId) ?? 0) + change)
  entry.returnItems.forEach((item) =>
    add(item.productId.toString(), lineBaseQuantity(item))
  )
  ;(entry.replacementItems ?? []).forEach((item) =>
    add(item.productId.toString(), -lineBaseQuantity(item))
  )
  return effect
}
