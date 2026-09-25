// Validates returned-item and optional replacement-item submissions.
import { z } from "zod"
import {
  objectIdSchema,
  quantitySchema,
  unitNameSchema,
} from "@/lib/db/validators/shared"

export const ReturnItemSchema = z
  .object({
    productId: objectIdSchema,
    // The unit the item was sold in on the sale; omitted means the base unit.
    unit: unitNameSchema,
    quantity: quantitySchema,
    unitPrice: z.number().min(0),
  })
  .strict()

export const CreateReturnSchema = z
  .object({
    saleId: objectIdSchema,
    returnItems: z.array(ReturnItemSchema).min(1),
    notes: z.string().optional(),
  })
  .strict()

export const UpdateReturnSchema = z
  .object({
    returnItems: z.array(ReturnItemSchema).min(1).optional(),
    notes: z.string().optional(),
  })
  .strict()
