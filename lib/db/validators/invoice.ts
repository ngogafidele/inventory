import { z } from "zod"
import { objectIdSchema } from "@/lib/db/validators/shared"

export const CreateInvoiceSchema = z
  .object({
    saleId: objectIdSchema,
    customerName: z.string().min(1),
    customerEmail: z.string().email().optional(),
    customerPhone: z.string().optional(),
    status: z.enum(["unpaid", "paid"]).optional(),
    dueDate: z.string().datetime().optional(),
  })
  .strict()

export const UpdateInvoiceSchema = z
  .object({
    status: z.enum(["unpaid", "paid"]).optional(),
    customerName: z.string().min(1).optional(),
    customerEmail: z.string().email().optional(),
    customerPhone: z.string().optional(),
    dueDate: z.string().datetime().optional(),
  })
  .strict()
