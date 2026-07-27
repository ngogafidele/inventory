// Validates manual balance sheet line items and their dated revisions.
import { z } from "zod"
import { BALANCE_SHEET_CATEGORIES } from "@/lib/db/models/BalanceSheetItem"

const dateInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date")

export const BalanceSheetItemSchema = z
  .object({
    category: z.enum(BALANCE_SHEET_CATEGORIES),
    name: z.string().trim().min(2).max(80),
    amount: z.number().min(0),
    effectiveDate: dateInput,
    notes: z.string().trim().max(200).optional(),
  })
  .strict()

// Deleting is itself a dated revision, so the tombstone carries an effective date.
export const BalanceSheetItemDeleteSchema = z
  .object({
    effectiveDate: dateInput.optional(),
  })
  .strict()

export type BalanceSheetItemInput = z.infer<typeof BalanceSheetItemSchema>
