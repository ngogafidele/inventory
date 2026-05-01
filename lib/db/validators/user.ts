import { z } from "zod"
import { storeArraySchema } from "@/lib/db/validators/shared"

export const CreateUserSchema = z
  .object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
    role: z.enum(["admin", "manager", "staff"]).default("staff"),
    stores: storeArraySchema,
    isActive: z.boolean().optional(),
  })
  .strict()

export const UpdateUserSchema = z
  .object({
    name: z.string().min(2).optional(),
    email: z.string().email().optional(),
    password: z.string().min(8).optional(),
    role: z.enum(["admin", "manager", "staff"]).optional(),
    stores: storeArraySchema.optional(),
    isActive: z.boolean().optional(),
  })
  .strict()

export const LoginSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8),
  })
  .strict()

export const ForgotPasswordSchema = z
  .object({
    email: z.string().email(),
  })
  .strict()

export const ResetPasswordSchema = z
  .object({
    token: z.string().min(20),
    password: z.string().min(8),
  })
  .strict()

export const SetupAdminSchema = z
  .object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
  })
  .strict()
