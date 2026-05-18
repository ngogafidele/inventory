import mongoose, { Schema } from "mongoose"

const ExpenseSchema = new Schema(
  {
    store: {
      type: String,
      enum: ["store1", "store2"],
      required: true,
    },
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    category: { type: String, trim: true, default: "", required: false },
    paymentMethod: {
      type: String,
      enum: ["cash", "mobile-money", "bank"],
      required: true,
    },
    date: { type: Date, required: true },
    notes: { type: String, default: "", trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
)

ExpenseSchema.index({ store: 1, date: -1 })
ExpenseSchema.index({ store: 1, category: 1 })

export type ExpenseDocument = mongoose.InferSchemaType<typeof ExpenseSchema>

export const Expense =
  (mongoose.models.Expense as mongoose.Model<ExpenseDocument>) ||
  mongoose.model<ExpenseDocument>("Expense", ExpenseSchema)
