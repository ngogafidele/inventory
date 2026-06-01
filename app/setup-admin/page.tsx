"use client"

// Implements initial administrator account setup for a new installation.
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react"
import { type FormEvent, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function SetupAdminPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSetup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)

    if (password !== confirmPassword) {
      setMessage("Admin setup passwords do not match.")
      return
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/auth/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        })

        const data = await response.json()
        if (!response.ok) {
          setMessage(data?.error ?? "Setup failed")
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
      <main className="mx-auto grid min-h-screen max-w-6xl items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:px-10">
        <section className="rounded-xl border border-border/80 bg-card p-5 shadow-xl sm:p-7">
          <Button
            asChild
            variant="outline"
            className="mb-6 h-11 border-[var(--brand-navy)] text-[var(--brand-navy)] hover:bg-[var(--brand-navy)] hover:text-white"
          >
            <Link href="/">
              <ArrowLeft className="size-4" />
              Go to Login Page
            </Link>
          </Button>

          <div className="mb-6">
            <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-[var(--brand-orange)] text-[var(--brand-navy)]">
              <ShieldCheck className="size-5" />
            </div>
            <h1 className="text-2xl font-semibold text-[var(--brand-navy)]">
              Create admin account
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This creates the first administrator and signs you in when setup is complete.
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
            onSubmit={handleSetup}
          >
            <label className="block space-y-2 text-sm font-medium text-foreground">
              Full name
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-11 pl-9"
                  placeholder="Admin name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  required
                />
              </div>
            </label>
            <label className="block space-y-2 text-sm font-medium text-foreground">
              Admin email
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-11 pl-9"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  autoComplete="email"
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
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type={showPassword ? "text" : "password"}
                  autoComplete="off"
                  name="inventory-admin-passcode"
                  required
                  minLength={8}
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
            <label className="block space-y-2 text-sm font-medium text-foreground">
              Confirm password
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-11 pl-9 pr-11"
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="off"
                  name="inventory-admin-passcode-confirm"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center text-muted-foreground transition hover:text-foreground"
                  onClick={() => setShowConfirmPassword((current) => !current)}
                  aria-label={
                    showConfirmPassword
                      ? "Hide confirm password"
                      : "Show confirm password"
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </label>

            <Button
              className="h-11 w-full bg-[var(--brand-orange)] font-semibold text-[var(--brand-navy)] hover:bg-[var(--brand-orange)]/90"
              disabled={isPending}
            >
              {isPending ? "Creating admin..." : "Create admin"}
            </Button>
          </form>

          <Button
            asChild
            variant="outline"
            className="mt-4 h-11 w-full border-[var(--brand-navy)] text-[var(--brand-navy)] hover:bg-[var(--brand-navy)] hover:text-white"
          >
            <Link href="/">
              <ArrowLeft className="size-4" />
              Go to Login Page
            </Link>
          </Button>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/80 bg-white shadow-sm">
              <Image
                src="/images/logo.png"
                alt="B Ikaze Hardware logo"
                width={96}
                height={96}
                priority
                className="h-full w-full object-contain p-2"
              />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase text-[var(--brand-orange-text)]">
                Initial system setup
              </p>
              <h2 className="text-3xl font-semibold text-[var(--brand-navy)] sm:text-4xl">
                One admin opens the whole workspace.
              </h2>
            </div>
          </div>

          <div className="space-y-3">
            {[
              "Secure access for B Ikaze daily operations.",
              "Store teams start from one trusted admin account.",
              "Inventory, sales, invoices, and alerts stay connected.",
            ].map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-lg border border-border/80 bg-white/70 p-4 text-sm text-muted-foreground shadow-sm"
              >
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[var(--brand-orange-text)]" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
