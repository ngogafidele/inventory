import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { User } from "@/lib/db/models/User"
import { PasswordResetToken } from "@/lib/db/models/PasswordResetToken"
import { ResetPasswordSchema } from "@/lib/db/validators/user"
import { hashPassword } from "@/lib/auth/hash"
import { hashPasswordResetToken } from "@/lib/auth/password-reset"

export async function POST(request: NextRequest) {
  try {
    const body = ResetPasswordSchema.parse(await request.json())
    await connectToDatabase()

    const tokenHash = hashPasswordResetToken(body.token)
    const resetToken = await PasswordResetToken.findOne({
      tokenHash,
      usedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    })

    if (!resetToken) {
      return NextResponse.json(
        { success: false, error: "Reset link is invalid or expired" },
        { status: 400 }
      )
    }

    const user = await User.findOne({
      _id: resetToken.userId,
      isAdmin: true,
      isActive: true,
    })

    if (!user) {
      resetToken.usedAt = new Date()
      await resetToken.save()
      return NextResponse.json(
        { success: false, error: "Reset link is invalid or expired" },
        { status: 400 }
      )
    }

    user.password = await hashPassword(body.password)
    await user.save()

    resetToken.usedAt = new Date()
    await resetToken.save()

    await PasswordResetToken.updateMany(
      {
        userId: user._id,
        usedAt: { $exists: false },
        _id: { $ne: resetToken._id },
      },
      { $set: { usedAt: new Date() } }
    )

    return NextResponse.json({
      success: true,
      message: "Password reset successfully. You can now sign in.",
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reset password"
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    )
  }
}
