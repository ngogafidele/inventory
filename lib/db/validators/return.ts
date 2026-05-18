import { z } from "zod"
import { objectIdSchema } from "@/lib/db/validators/shared"

const paymentMethodSchema = z.enum(["cash", "mobile-money", "bank"])

const ReturnItemSchema = z
  .object({
    productId: objectIdSchema,
    quantity: z.number().int().min(1),
  })
  .strict()

export const CreateReturnSchema = z
  .object({
    saleId: objectIdSchema,
    items: z.array(ReturnItemSchema).min(1),
    refundAmount: z.number().min(0),
    refundMethod: paymentMethodSchema,
    reason: z.string().min(1),
    returnDate: z.string().min(1),
    customerName: z.string().min(1),
    customerPhone: z.string().min(1),
    notes: z.string().optional(),
  })
  .strict()

export const UpdateReturnSchema = z
  .object({
    saleId: objectIdSchema.optional(),
    items: z.array(ReturnItemSchema).min(1).optional(),
    refundAmount: z.number().min(0).optional(),
    refundMethod: paymentMethodSchema.optional(),
    reason: z.string().min(1).optional(),
    returnDate: z.string().min(1).optional(),
    customerName: z.string().min(1).optional(),
    customerPhone: z.string().min(1).optional(),
    notes: z.string().optional(),
  })
  .strict()
