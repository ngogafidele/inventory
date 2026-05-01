export async function sendAdminPasswordResetEmail({
  to,
  resetUrl,
}: {
  to: string
  resetUrl: string
}) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.PASSWORD_RESET_EMAIL_FROM

  if (!apiKey || !from) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[Password Reset Link]", resetUrl)
    } else {
      console.warn("Password reset email provider is not configured")
    }
    return
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: "Reset your admin password",
      html: `
        <p>A password reset was requested for your inventory admin account.</p>
        <p>Click the link below, enter a new password, and submit the form to finish resetting your password.</p>
        <p><a href="${resetUrl}">Reset your password</a></p>
        <p>This link expires in 30 minutes and can only be used once. If you did not request it, ignore this email.</p>
      `,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "")
    throw new Error(
      `Failed to send password reset email: ${response.status} ${errorBody}`
    )
  }
}
