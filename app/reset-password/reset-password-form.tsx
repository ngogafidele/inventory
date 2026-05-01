"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleReset = () => {
    setMessage(null)
    setIsSuccess(false)

    if (!token) {
      setMessage("Reset token is missing. Use the link from your email.")
      return
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.")
      return
    }

    startTransition(async () => {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })

      const data = await response.json()
      if (!response.ok) {
        setMessage(data?.error ?? "Failed to reset password")
        return
      }

      setIsSuccess(true)
      setMessage(data?.message ?? "Password reset successfully.")
      setPassword("")
      setConfirmPassword("")
    })
  }

  return (
    <section className="rounded-2xl border border-border/80 bg-card/95 p-5 shadow-sm backdrop-blur sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <KeyRound className="size-4 text-primary" />
        <h1 className="text-xl font-semibold">Reset admin password</h1>
      </div>

      {message ? (
        <div
          className={
            isSuccess
              ? "mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700"
              : "mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          }
        >
          {message}
        </div>
      ) : null}

      {!isSuccess ? (
        <div className="space-y-3">
          <Input
            placeholder="New password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
          />
          <Input
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            type="password"
          />
          <Button onClick={handleReset} disabled={isPending}>
            Reset password
          </Button>
        </div>
      ) : (
        <Button asChild>
          <Link href="/">Back to sign in</Link>
        </Button>
      )}
    </section>
  )
}
