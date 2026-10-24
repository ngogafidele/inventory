import { z } from "zod"
import { UpdateProductSchema } from "@/lib/db/validators/product"
import { getCostUnit } from "@/lib/utils/units"

// A complete catalog snapshot, deliberately excluding live inventory quantity.
export const ProductEditSchema = z.object({
  name: z.string().trim().min(1), unit: z.string().trim().min(1),
  packUnits: z.array(z.object({ name: z.string().trim().min(1).max(40), factor: z.number().int().min(2), price: z.number().min(0) }).strict()).max(10),
  costUnit: z.string().trim().min(1).max(40),
  lowStockThreshold: z.number().int().min(0), costPrice: z.number().min(0), price: z.number().min(0),
}).strict().superRefine((value, ctx) => {
  const result = UpdateProductSchema.safeParse(value)
  if (!result.success) for (const issue of result.error.issues) ctx.addIssue({ code: "custom", message: issue.message, path: issue.path })
  if (![value.unit, ...value.packUnits.map((pack) => pack.name)].includes(value.costUnit)) {
    ctx.addIssue({ code: "custom", message: "Choose an existing cost unit.", path: ["costUnit"] })
  }
})
export type ProductEdit = z.infer<typeof ProductEditSchema>

export function productEditSnapshot(product: {
  name: string; unit?: string | null; packUnits?: Array<{ name: string; factor: number; price: number }> | null
  costUnit?: string | null; lowStockThreshold?: number | null; costPrice: number; price: number
}): ProductEdit {
  return {
    name: product.name,
    unit: product.unit ?? "pcs",
    packUnits: (product.packUnits ?? []).map(({ name, factor, price }) => ({ name, factor, price })),
    costUnit: getCostUnit(product).name,
    lowStockThreshold: product.lowStockThreshold ?? 0,
    costPrice: product.costPrice,
    price: product.price,
  }
}

export function sameProductEdit(a: ProductEdit, b: ProductEdit) {
  return JSON.stringify(productEditSnapshot(a)) === JSON.stringify(productEditSnapshot(b))
}
