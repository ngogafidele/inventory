// Validates product catalog, pricing, stock, and category payloads.
import { z } from "zod"
import { objectIdSchema } from "@/lib/db/validators/shared"

export const CreateProductSchema = z
  .object({
    name: z.string().trim().min(1),
    unit: z.string().trim().min(1),
    quantity: z.number().int().min(0),
    lowStockThreshold: z.number().int().min(0).optional().default(0),
    costPrice: z.number().min(0),
    price: z.number().min(0),
    supplierName: z.string().trim().optional(),
    supplierPhone: z.string().trim().optional(),
    categoryId: objectIdSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasSupplierName = Boolean(value.supplierName)
    const hasSupplierPhone = Boolean(value.supplierPhone)

    if (hasSupplierName !== hasSupplierPhone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Supplier name and phone must be provided together.",
        path: hasSupplierName ? ["supplierPhone"] : ["supplierName"],
      })
    }
  })

export const UpdateProductSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    unit: z.string().trim().min(1).optional(),
    quantity: z.number().int().min(0).optional(),
    lowStockThreshold: z.number().int().min(0).optional(),
    costPrice: z.number().min(0).optional(),
    price: z.number().min(0).optional(),
    categoryId: objectIdSchema.optional(),
  })
  .strict()
