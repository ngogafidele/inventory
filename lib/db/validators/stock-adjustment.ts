// Validates manual stock changes and their required audit reasons.
import { z } from "zod"
import { objectIdSchema } from "@/lib/db/validators/shared"

export const CreateStockAdjustmentSchema = z
  .object({
    productId: objectIdSchema,
    quantityChange: z.number().int(),
    reason: z.string().min(2),
  })
  .strict()
