import { z } from "zod"
import { objectIdSchema } from "@/lib/db/validators/shared"

export const ReturnItemSchema = z
  .object({
    productId: objectIdSchema,
    quantity: z.number().int().min(1),
    unitPrice: z.number().min(0),
  })
  .strict()

export const CreateReturnSchema = z
  .object({
    returnItems: z.array(ReturnItemSchema).min(1),
    replacementItems: z.array(ReturnItemSchema).min(1),
    notes: z.string().optional(),
  })
  .strict()

export const UpdateReturnSchema = z
  .object({
    returnItems: z.array(ReturnItemSchema).min(1).optional(),
    replacementItems: z.array(ReturnItemSchema).min(1).optional(),
    notes: z.string().optional(),
  })
  .strict()
