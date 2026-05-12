import { z } from "zod"
import { objectIdSchema } from "@/lib/db/validators/shared"

const optionalTextSchema = z
  .preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.union([z.string(), z.undefined()])
  )
  .optional()

const optionalEmailSchema = z
  .preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.union([z.string().email(), z.undefined()])
  )
  .optional()

const ProformaItemSchema = z.object({
  description: z.string().min(1),
  unit: z.string().min(1).optional().default("pcs"),
  quantity: z.coerce.number().int().min(1),
  unitPrice: z.coerce.number().min(0),
})

export const CreateProformaSchema = z
  .object({
    saleId: objectIdSchema.optional(),
    customerName: z.string().min(1),
    customerEmail: optionalEmailSchema,
    customerPhone: optionalTextSchema,
    items: z.array(ProformaItemSchema).min(1).optional(),
    expiresAt: z.string().datetime().optional(),
  })
  .strict()
  .refine((value) => value.saleId || value.items?.length, {
    message: "Provide saleId or at least one item",
  })

export const ProformaListQuerySchema = z.object({
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
})
