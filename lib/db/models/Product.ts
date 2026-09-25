// Persists branch-owned products, pricing, and available quantities.
import mongoose, { Schema } from "mongoose"

// A named multiple of the base unit, e.g. crate = 24 bottles, with its own
// default selling price. Only stores in PACK_UNIT_STORES may set these.
const PackUnitSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    factor: { type: Number, required: true, min: 2 },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
)

const ProductSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true },
    // The base unit: stock, cost, and the low-stock threshold are all counted
    // in it, and `price` is the selling price of one base unit.
    unit: { type: String, required: true, trim: true, default: "pcs" },
    packUnits: { type: [PackUnitSchema], default: [] },
    // Unit cost is entered and shown in (see getCostUnit); costPrice itself
    // stays per base unit.
    costUnit: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    lowStockThreshold: { type: Number, min: 0, default: 0 },
    costPrice: { type: Number, required: true, min: 0, default: 0 },
    price: { type: Number, required: true, min: 0 },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
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
ProductSchema.index(
  { store: 1, name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
)

export type ProductDocument = mongoose.InferSchemaType<typeof ProductSchema>

export const Product =
  (mongoose.models.Product as mongoose.Model<ProductDocument>) ||
  mongoose.model<ProductDocument>("Product", ProductSchema)
