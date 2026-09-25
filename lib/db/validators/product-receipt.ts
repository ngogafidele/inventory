// Validates supplier product receipt payloads.
import { z } from "zod"
import { quantitySchema, unitNameSchema } from "@/lib/db/validators/shared"

export const CreateProductReceiptSchema = z
  .object({
    supplierName: z.string().trim().min(1),
    supplierPhone: z.string().trim().min(1),
    // The unit bought in (e.g. sack); unit cost is per that unit.
    unit: unitNameSchema,
    quantity: quantitySchema,
    unitCost: z.number().min(0),
    receivedAt: z.string().min(1),
  })
  .strict()
