import { z } from "zod"
import { objectIdSchema } from "@/lib/db/validators/shared"

export const SaleItemSchema = z
  .object({
    productId: objectIdSchema,
    quantity: z.number().int().min(1),
    sellingPrice: z.number().min(0),
  })
  .strict()

export const CreateSaleSchema = z
  .object({
    items: z.array(SaleItemSchema).min(1),
    notes: z.string().optional(),
  })
  .strict()
