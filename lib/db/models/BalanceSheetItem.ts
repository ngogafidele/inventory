// Persists user-entered balance sheet line items as an append-only version history.
//
// Each document is one immutable version. Edits and deletes insert a new version (a
// "deleted" version is a tombstone) sharing the original `groupId`, so a balance
// sheet for a past date resolves to the version in effect on that date and never
// changes retroactively.
import mongoose, { Schema } from "mongoose"

export const BALANCE_SHEET_CATEGORIES = [
  "current_asset",
  "fixed_asset",
  "current_liability",
  "long_term_liability",
  "equity",
] as const

export type BalanceSheetCategory = (typeof BALANCE_SHEET_CATEGORIES)[number]

const BalanceSheetItemSchema = new Schema(
  {
    store: {
      type: String,
      enum: ["store1", "store2"],
      required: true,
    },
    // Stable identity shared by every version of the same logical line item.
    groupId: { type: Schema.Types.ObjectId, required: true },
    category: {
      type: String,
      enum: BALANCE_SHEET_CATEGORIES,
      required: true,
    },
    name: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    // The date this version takes effect; it applies to sheets on/after this date.
    effectiveDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["active", "deleted"],
      default: "active",
      required: true,
    },
    notes: { type: String, default: "", trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
)

BalanceSheetItemSchema.index({
  store: 1,
  groupId: 1,
  effectiveDate: 1,
  createdAt: 1,
})

export type BalanceSheetItemDocument = mongoose.InferSchemaType<
  typeof BalanceSheetItemSchema
>

export const BalanceSheetItem =
  (mongoose.models.BalanceSheetItem as mongoose.Model<BalanceSheetItemDocument>) ||
  mongoose.model<BalanceSheetItemDocument>(
    "BalanceSheetItem",
    BalanceSheetItemSchema
  )
