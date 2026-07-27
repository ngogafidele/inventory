"use client"

// Collects the password that opens the sensitive pages. Holds no data from the
// page it guards — the server never sent any.
import { useRouter } from "next/navigation"
import { Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react"
import { type FormEvent, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { REAUTH_WINDOW_SECONDS } from "@/lib/auth/reauth"

const WINDOW_MINUTES = Math.round(REAUTH_WINDOW_SECONDS / 60)

export function ReauthForm({
  target,
  email,
}: {
  target: string
  email: string
}) {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleVerify = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)

    startTransition(async () => {
      try {
        const response = await fetch("/api/auth/reauth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        })

        const data = await response.json()
        if (!response.ok) {
          setMessage(data?.error ?? "Verification failed")
          setPassword("")
          return
        }

        // refresh() so the destination re-renders against the token the server
        // just re-issued, rather than anything cached from before the check.
        router.replace(target)
        router.refresh()
      } catch {
        setMessage("Network problem. Please try again.")
      }
    })
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <section className="w-full max-w-md rounded-xl border border-border/80 bg-card p-5 shadow-xl sm:p-7">
        <div className="mb-6">
          <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-[var(--brand-navy)] text-white">
            <ShieldCheck className="size-5" />
          </div>
          <h1 className="text-2xl font-semibold text-[var(--brand-navy)]">
            Confirm your password
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This page shows store financials. Re-enter the password for{" "}
            <span className="font-medium text-foreground">{email}</span> to
            continue. You will not be asked again for {WINDOW_MINUTES} minutes.
          </p>
        </div>

        {message ? (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {message}
          </div>
        ) : null}

        <form className="space-y-4" autoComplete="off" onSubmit={handleVerify}>
          <label className="block space-y-2 text-sm font-medium text-foreground">
            Password
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-11 pl-9 pr-11"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                name="inventory-verify-passcode"
                autoFocus
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center text-muted-foreground transition hover:text-foreground"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </label>

          <Button
            type="submit"
            className="h-11 w-full bg-[var(--brand-navy)] text-white hover:bg-[var(--brand-navy)]/90"
            disabled={isPending}
          >
            {isPending ? "Verifying..." : "Continue"}
          </Button>
        </form>
      </section>
    </main>
  )
}
