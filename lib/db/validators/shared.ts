import { z } from "zod"

export const storeSchema = z.enum(["store1", "store2"])
export const storeArraySchema = z.array(storeSchema).min(1)
export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid id")
