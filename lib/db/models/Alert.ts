import mongoose, { Schema } from "mongoose"

const AlertSchema = new Schema(
  {
    store: {
      type: String,
      enum: ["store1", "store2"],
      required: true,
    },
    type: {
      type: String,
      enum: ["low-stock", "custom"],
      required: true,
    },
    message: { type: String, required: true },
    severity: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "low",
    },
    productId: { type: Schema.Types.ObjectId, ref: "Product" },
    isResolved: { type: Boolean, default: false },
    resolvedAt: { type: Date },
  },
  { timestamps: true }
)

AlertSchema.index({ store: 1 })
AlertSchema.index({ store: 1, productId: 1 })

export type AlertDocument = mongoose.InferSchemaType<typeof AlertSchema>

export const Alert =
  (mongoose.models.Alert as mongoose.Model<AlertDocument>) ||
  mongoose.model<AlertDocument>("Alert", AlertSchema)
