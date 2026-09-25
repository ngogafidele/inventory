// Supplies common store and identifier schemas used across endpoints.
import { z } from "zod"

export const storeSchema = z.enum(["store1", "store2"])
export const storeArraySchema = z.array(storeSchema).min(1)
export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid id")

// A quantity in whatever unit was chosen: positive, up to 3 decimals. Whether
// it converts to whole base units is checked against the product's units.
export const quantitySchema = z
  .number()
  .positive()
  .refine(
    (value) => Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-6,
    "Quantities can have at most 3 decimal places."
  )

// Optional unit name; omitted means the product's base unit.
export const unitNameSchema = z.string().trim().min(1).max(40).optional()
