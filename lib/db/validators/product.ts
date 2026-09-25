// Validates product catalog, pricing, stock, and category payloads.
import { z } from "zod"
import { objectIdSchema } from "@/lib/db/validators/shared"
import { normalizeUnitName } from "@/lib/utils/units"

const PackUnitSchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    factor: z.number().int().min(2),
    price: z.number().min(0),
  })
  .strict()

// Package unit names must be unique and differ from the base unit, since a
// sale line picks its unit by name. Whether the store may use package units
// at all is checked in the route, which knows the store.
function checkPackUnits(
  value: { unit?: string; packUnits?: Array<{ name: string }> },
  ctx: z.RefinementCtx
) {
  if (!value.packUnits) return
  const seen = new Set<string>()
  if (value.unit) seen.add(normalizeUnitName(value.unit))
  value.packUnits.forEach((pack, index) => {
    const key = normalizeUnitName(pack.name)
    if (seen.has(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unit "${pack.name}" is listed more than once or matches the base unit.`,
        path: ["packUnits", index, "name"],
      })
    }
    seen.add(key)
  })
}

export const CreateProductSchema = z
  .object({
    name: z.string().trim().min(1),
    unit: z.string().trim().min(1),
    packUnits: z.array(PackUnitSchema).max(10).optional().default([]),
    costUnit: z.string().trim().min(1).max(40).optional(),
    // Stock is always sent in base units; openingUnit only records which unit
    // it was counted in (e.g. crates) on the opening supplier receipt.
    quantity: z.number().int().min(0),
    openingUnit: z.string().trim().min(1).max(40).optional(),
    lowStockThreshold: z.number().int().min(0).optional().default(0),
    costPrice: z.number().min(0),
    price: z.number().min(0),
    supplierName: z.string().trim().optional(),
    supplierPhone: z.string().trim().optional(),
    categoryId: objectIdSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    checkPackUnits(value, ctx)
    const hasSupplierName = Boolean(value.supplierName)
    const hasSupplierPhone = Boolean(value.supplierPhone)

    if (hasSupplierName !== hasSupplierPhone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Supplier name and phone must be provided together.",
        path: hasSupplierName ? ["supplierPhone"] : ["supplierName"],
      })
    }
  })

export const UpdateProductSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    unit: z.string().trim().min(1).optional(),
    packUnits: z.array(PackUnitSchema).max(10).optional(),
    costUnit: z.string().trim().min(1).max(40).optional(),
    quantity: z.number().int().min(0).optional(),
    lowStockThreshold: z.number().int().min(0).optional(),
    costPrice: z.number().min(0).optional(),
    price: z.number().min(0).optional(),
    categoryId: objectIdSchema.optional(),
  })
  .strict()
  .superRefine(checkPackUnits)
