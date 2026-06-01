"use client"

// Implements the public login entry point for authenticated operations.
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  PackageCheck,
} from "lucide-react"
import { type FormEvent, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function Home() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)

    startTransition(async () => {
      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        })

        const data = await response.json()
        if (!response.ok) {
          setMessage(data?.error ?? "Login failed")
          return
        }

        router.push("/dashboard")
        router.refresh()
      } catch (error) {
        setMessage("Network error. Check your connection and try again.")
      }
    })
  }

  return (
    <div className="brand-auth-surface min-h-screen">
      <main className="mx-auto grid min-h-screen max-w-6xl items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-10">
        <section className="order-2 space-y-8 lg:order-1">
          <div className="flex items-center gap-4">
            <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/80 bg-white shadow-sm">
              <Image
                src="/images/logo.png"
                alt="B Ikaze Hardware logo"
                width={80}
                height={80}
                priority
                className="h-full w-full object-contain p-2"
              />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase text-[var(--brand-orange-text)]">
                B Ikaze Hardware
              </p>
              <h1 className="text-3xl font-semibold text-[var(--brand-navy)] sm:text-4xl">
                Inventory control for every counter.
              </h1>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              "Track stock across stores",
              "Manage products and sales",
              "Review invoices and alerts",
            ].map((item) => (
              <div
                key={item}
                className="rounded-lg border border-border/80 bg-white/70 p-4 text-sm font-medium text-[var(--brand-navy)] shadow-sm"
              >
                <PackageCheck className="mb-3 size-5 text-[var(--brand-orange-text)]" />
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="order-1 rounded-xl border border-border/80 bg-card p-5 shadow-xl sm:p-7 lg:order-2">
          <div className="mb-6">
            <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-[var(--brand-navy)] text-white">
              <KeyRound className="size-5" />
            </div>
            <h2 className="text-2xl font-semibold text-[var(--brand-navy)]">
              Sign in
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Use your staff or admin account to continue to the dashboard.
            </p>
          </div>

          {message ? (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {message}
            </div>
          ) : null}

          <form
            className="space-y-4"
            autoComplete="off"
            onSubmit={handleLogin}
          >
            <label className="block space-y-2 text-sm font-medium text-foreground">
              Email or username
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-11 pl-9"
                  placeholder="Email or username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="text"
                  autoComplete="off"
                  name="inventory-login-user"
                  required
                />
              </div>
            </label>
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
                  autoComplete="off"
                  name="inventory-login-passcode"
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
              className="h-11 w-full bg-[var(--brand-navy)] text-white hover:bg-[var(--brand-navy)]/90"
              disabled={isPending}
            >
              {isPending ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <div className="mt-6 border-t border-border pt-5">
            <p className="text-sm text-muted-foreground">
              Setting up the system for the first time?
            </p>
            <Button
              asChild
              variant="secondary"
              className="mt-3 h-11 w-full border border-[var(--brand-orange)] bg-[var(--brand-orange)] font-semibold text-[var(--brand-navy)] hover:bg-[var(--brand-orange)]/90"
            >
              <Link href="/setup-admin">
                Get Started
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  )
}
