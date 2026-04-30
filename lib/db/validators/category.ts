import { z } from "zod"

export const CreateCategorySchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
  })
  .strict()

export const UpdateCategorySchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
  })
  .strict()
