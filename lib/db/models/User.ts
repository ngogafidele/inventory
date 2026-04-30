import mongoose, { Schema } from "mongoose"

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    isAdmin: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    role: {
      type: String,
      enum: ["admin", "manager", "staff"],
      default: "staff",
    },
    stores: [
      {
        type: String,
        enum: ["store1", "store2"],
        required: true,
      },
    ],
    lastLogin: { type: Date },
    lastLogout: { type: Date },
  },
  { timestamps: true }
)

export type UserDocument = mongoose.InferSchemaType<typeof UserSchema>

export const User = mongoose.models.User || mongoose.model("User", UserSchema)
