// Validates delivery note metadata and selected source sales.
import { z } from "zod"
import { objectIdSchema } from "@/lib/db/validators/shared"

const deliveryNoteFields = {
  saleIds: z.array(objectIdSchema).min(1),
  customerName: z.string().min(1),
  customerLocation: z.string().min(1),
  deliveryLocation: z.string().min(1),
  deliveryDate: z.string().datetime(),
  deliveredByName: z.string().min(1),
  deliveredByPhone: z.string().optional(),
  deliveredByDate: z.string().datetime(),
}

export const CreateDeliveryNoteSchema = z.object(deliveryNoteFields).strict()

export const UpdateDeliveryNoteSchema = z
  .object(deliveryNoteFields)
  .partial()
  .extend({
    saleIds: z.array(objectIdSchema).min(1).optional(),
  })
  .strict()
