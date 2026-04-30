import { z } from "zod"
import { objectIdSchema } from "@/lib/db/validators/shared"

export const CreateAlertSchema = z
  .object({
    type: z.enum(["low-stock", "custom"]),
    message: z.string().min(1),
    severity: z.enum(["low", "medium", "high"]).optional(),
    productId: objectIdSchema.optional(),
  })
  .strict()

export const UpdateAlertSchema = z
  .object({
    isResolved: z.boolean().optional(),
    severity: z.enum(["low", "medium", "high"]).optional(),
  })
  .strict()
