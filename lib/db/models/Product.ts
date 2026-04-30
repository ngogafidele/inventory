import mongoose, { Schema } from "mongoose"

const ProductSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true },
    unit: { type: String, required: true, trim: true, default: "pcs" },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    lowStockThreshold: { type: Number, min: 0, default: 0 },
    costPrice: { type: Number, required: true, min: 0, default: 0 },
    price: { type: Number, required: true, min: 0 },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    store: {
      type: String,
      enum: ["store1", "store2"],
      required: true,
    },
  },
  { timestamps: true }
)

ProductSchema.index({ store: 1 })
ProductSchema.index({ store: 1, sku: 1 }, { unique: true })

export type ProductDocument = mongoose.InferSchemaType<typeof ProductSchema>

export const Product =
  mongoose.models.Product || mongoose.model("Product", ProductSchema)
