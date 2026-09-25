// Persists delivery notes generated from one or more branch sales.
import mongoose, { Schema } from "mongoose"

const DeliveryNoteItemSchema = new Schema(
  {
    description: { type: String, required: true, trim: true },
    sku: { type: String, default: "", trim: true },
    unit: { type: String, required: true, default: "pcs", trim: true },
    quantity: { type: Number, required: true, min: 0.001 },
  },
  { _id: false }
)

const DeliveryNoteSchema = new Schema(
  {
    store: {
      type: String,
      enum: ["store1", "store2"],
      required: true,
    },
    saleIds: [{ type: Schema.Types.ObjectId, ref: "Sale", required: true }],
    deliveryNoteNumber: { type: String, required: true },
    customerName: { type: String, required: true, trim: true },
    customerLocation: { type: String, required: true, trim: true },
    deliveryLocation: { type: String, required: true, trim: true },
    deliveryDate: { type: Date, required: true },
    deliveredByName: { type: String, required: true, trim: true },
    deliveredByPhone: { type: String, default: "", trim: true },
    deliveredByDate: { type: Date, required: true },
    items: { type: [DeliveryNoteItemSchema], default: [] },
    issuedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

DeliveryNoteSchema.index({ store: 1 })
DeliveryNoteSchema.index(
  { store: 1, deliveryNoteNumber: 1 },
  { unique: true }
)
DeliveryNoteSchema.index({ store: 1, issuedAt: -1 })
DeliveryNoteSchema.index({ store: 1, saleIds: 1 })

export type DeliveryNoteDocument = mongoose.InferSchemaType<
  typeof DeliveryNoteSchema
>

export const DeliveryNote =
  (mongoose.models.DeliveryNote as mongoose.Model<DeliveryNoteDocument>) ||
  mongoose.model<DeliveryNoteDocument>("DeliveryNote", DeliveryNoteSchema)
