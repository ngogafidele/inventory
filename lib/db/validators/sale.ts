// Validates sales, payments, and customer receivable details.
import { z } from "zod"
import { objectIdSchema } from "@/lib/db/validators/shared"

export const SaleItemSchema = z
  .object({
    productId: objectIdSchema,
    quantity: z.number().int().min(1),
    sellingPrice: z.number().min(0),
    costPrice: z.number().min(0).optional(),
  })
  .strict()

const OutstandingSchema = z
  .object({
    customerName: z.string().min(1),
    customerPhone: z.string().min(1),
    paymentDate: z.string().min(1),
  })
  .strict()

const SalePayloadSchema = z
  .object({
    items: z.array(SaleItemSchema).min(1),
    notes: z.string().optional(),
    paymentStatus: z.enum(["paid", "unpaid"]).optional(),
    paymentMethod: z.enum(["cash", "bank", "mobile"]).optional(),
    outstanding: OutstandingSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const status = value.paymentStatus ?? "paid"

    if (status === "paid") {
      if (!value.paymentMethod) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Payment method is required for paid sales.",
          path: ["paymentMethod"],
        })
      }
      return
    }

    if (!value.outstanding) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Outstanding customer details are required for unpaid sales.",
        path: ["outstanding"],
      })
    }

    if (value.paymentMethod) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Payment method should be omitted for unpaid sales.",
        path: ["paymentMethod"],
      })
    }
  })

export const CreateSaleSchema = SalePayloadSchema
export const UpdateSaleSchema = SalePayloadSchema
