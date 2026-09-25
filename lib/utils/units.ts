// Converts between a product's base unit and its package units.
//
// Stock is always held as a whole number of the product's base unit (the
// smallest amount ever sold: a piece, a bottle, a gram). Package units such as
// a crate or a sack are named multiples of it. A quantity entered in any unit
// is converted to base units before it touches stock, so the existing
// "never below zero" guards keep working on exact integers.
//
// Kept free of server-only imports so screens and route handlers share one
// set of rules.

export type PackUnit = {
  name: string
  // Base units in one of this unit, e.g. 24 bottles in a crate.
  factor: number
  // Default selling price for one of this unit.
  price: number
}

export type UnitOption = PackUnit & { isBase: boolean }

type ProductUnits = {
  unit?: string | null
  price: number
  packUnits?: PackUnit[] | null
  // Unit the cost is entered and shown in; see getCostUnit.
  costUnit?: string | null
}

// Suggestions only; any unit name is accepted.
export const COMMON_UNITS = [
  "pcs",
  "bottle",
  "box",
  "crate",
  "carton",
  "pack",
  "dozen",
  "sack",
  "bag",
  "kg",
  "g",
  "litre",
  "ml",
] as const

// Quantities may carry up to this many decimals, e.g. 1.25 kg.
export const QUANTITY_DECIMALS = 3

export function getBaseUnit(product: Pick<ProductUnits, "unit">) {
  return product.unit?.trim() || "pcs"
}

export function normalizeUnitName(name: string) {
  return name.trim().toLowerCase()
}

// Base unit first, then package units from smallest to largest.
export function getUnitOptions(product: ProductUnits): UnitOption[] {
  const packs = [...(product.packUnits ?? [])].sort(
    (a, b) => a.factor - b.factor
  )
  return [
    { name: getBaseUnit(product), factor: 1, price: product.price, isBase: true },
    // Fields are read one by one: route handlers pass Mongoose documents, and
    // spreading a subdocument copies its internals, not name/factor/price.
    ...packs.map((pack) => ({
      name: pack.name,
      factor: pack.factor,
      price: pack.price,
      isBase: false,
    })),
  ]
}

// An empty unit name means the base unit, which keeps older clients working.
export function findUnitOption(
  product: ProductUnits,
  unitName?: string | null
): UnitOption | null {
  const options = getUnitOptions(product)
  if (!unitName?.trim()) return options[0]
  const wanted = normalizeUnitName(unitName)
  return options.find((option) => normalizeUnitName(option.name) === wanted) ?? null
}

// The unit people think of cost in: what the supplier charges for. It is the
// product's chosen costUnit, else its largest package unit (crate, sack, box),
// else the base unit. Cost is still stored per base unit; this only decides
// how it is entered and displayed (12,000 per crate is stored as 500 per bottle).
export function getCostUnit(product: ProductUnits): UnitOption {
  const chosen = product.costUnit ? findUnitOption(product, product.costUnit) : null
  if (chosen) return chosen
  const options = getUnitOptions(product)
  return options[options.length - 1]
}

// Returns the whole number of base units, or null when the quantity does not
// convert to one (e.g. 0.3 of a 24-bottle crate is 7.2 bottles).
export function toBaseQuantity(quantity: number, factor: number) {
  if (!Number.isFinite(quantity) || !Number.isFinite(factor)) return null
  if (quantity <= 0 || factor < 1) return null
  const base = quantity * factor
  const rounded = Math.round(base)
  // Tolerates float noise such as 1.1 * 1000 = 1100.0000000000002.
  if (Math.abs(base - rounded) > 1e-6) return null
  return rounded
}

// Sale, return, and receipt lines saved before package units existed have no
// base quantity; they were always recorded in the base unit.
export function lineBaseQuantity(line: {
  quantity: number
  unitFactor?: number | null
  baseQuantity?: number | null
}) {
  if (typeof line.baseQuantity === "number") return line.baseQuantity
  return Math.round(line.quantity * (line.unitFactor ?? 1))
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

// Costs are stored per base unit and multiplied back up to a crate or a
// 50,000 g sack for display, so they keep 8 decimals: 4 would already show
// 61,234 per sack as 61,235.
export function roundCost(value: number) {
  return Math.round(value * 100_000_000) / 100_000_000
}

export function formatQuantity(value: number) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: QUANTITY_DECIMALS,
  })
}

// "7 crate + 19 bottle": the largest package units first, the remainder in
// the base unit. Zero stock reads "0 bottle".
export function formatStock(
  baseQuantity: number,
  product: Pick<ProductUnits, "unit" | "packUnits">
) {
  const baseUnit = getBaseUnit(product)
  const packs = [...(product.packUnits ?? [])].sort(
    (a, b) => b.factor - a.factor
  )
  if (packs.length === 0 || baseQuantity <= 0) {
    return `${formatQuantity(baseQuantity)} ${baseUnit}`
  }

  let remaining = Math.round(baseQuantity)
  const parts: string[] = []
  for (const pack of packs) {
    const count = Math.floor(remaining / pack.factor)
    if (count > 0) {
      parts.push(`${formatQuantity(count)} ${pack.name}`)
      remaining -= count * pack.factor
    }
  }
  if (remaining > 0 || parts.length === 0) {
    parts.push(`${formatQuantity(remaining)} ${baseUnit}`)
  }
  return parts.join(" + ")
}

// "crate (24 bottle)": how a package unit relates to the base unit.
export function describeUnit(option: UnitOption, baseUnit: string) {
  return option.isBase
    ? option.name
    : `${option.name} (${formatQuantity(option.factor)} ${baseUnit})`
}
