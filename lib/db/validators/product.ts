import { z } from "zod"
import { objectIdSchema } from "@/lib/db/validators/shared"

export const CreateProductSchema = z
  .object({
    name: z.string().min(1),
    unit: z.string().min(1),
    quantity: z.number().int().min(0),
    lowStockThreshold: z.number().int().min(0).optional().default(0),
    costPrice: z.number().min(0),
    price: z.number().min(0),
    categoryId: objectIdSchema,
  })
  .strict()

export const UpdateProductSchema = z
  .object({
    name: z.string().min(1).optional(),
    unit: z.string().min(1).optional(),
    quantity: z.number().int().min(0).optional(),
    lowStockThreshold: z.number().int().min(0).optional(),
    costPrice: z.number().min(0).optional(),
    price: z.number().min(0).optional(),
    categoryId: objectIdSchema.optional(),
  })
  .strict()
