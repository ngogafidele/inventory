import mongoose, { Schema } from "mongoose"

const UserLoginLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    role: {
      type: String,
      enum: ["admin", "manager", "staff"],
      required: true,
    },
    loginAt: { type: Date, required: true, default: Date.now },
    logoutAt: { type: Date },
  },
  { timestamps: true }
)

UserLoginLogSchema.index({ loginAt: -1 })
UserLoginLogSchema.index({ userId: 1, loginAt: -1 })

export type UserLoginLogDocument = mongoose.InferSchemaType<
  typeof UserLoginLogSchema
>

export const UserLoginLog =
  mongoose.models.UserLoginLog ||
  mongoose.model("UserLoginLog", UserLoginLogSchema)
