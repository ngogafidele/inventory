// Validates branch expense payloads and supported payment methods.
import { z } from "zod"

const paymentMethodSchema = z.enum(["cash", "mobile-money", "bank"])

export const CreateExpenseSchema = z
  .object({
    description: z.string().min(1),
    amount: z.number().min(0),
    category: z.string().optional(),
    paymentMethod: paymentMethodSchema,
    date: z.string().min(1),
    notes: z.string().optional(),
  })
  .strict()

export const UpdateExpenseSchema = z
  .object({
    description: z.string().min(1).optional(),
    amount: z.number().min(0).optional(),
    category: z.string().optional(),
    paymentMethod: paymentMethodSchema.optional(),
    date: z.string().min(1).optional(),
    notes: z.string().optional(),
  })
  .strict()
