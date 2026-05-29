// Validates supplier product receipt payloads.
import { z } from "zod"

export const CreateProductReceiptSchema = z
  .object({
    supplierName: z.string().trim().min(1),
    supplierPhone: z.string().trim().min(1),
    quantity: z.number().int().min(1),
    unitCost: z.number().min(0),
    receivedAt: z.string().min(1),
  })
  .strict()
