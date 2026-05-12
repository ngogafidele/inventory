"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { KeyRound, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function Home() {
  const router = useRouter()
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [setupName, setSetupName] = useState("")
  const [setupEmail, setSetupEmail] = useState("")
  const [setupPassword, setSetupPassword] = useState("")
  const [setupConfirmPassword, setSetupConfirmPassword] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleLogin = () => {
    setMessage(null)
    startTransition(async () => {
      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: loginEmail,
            password: loginPassword,
          }),
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

  const handleSetup = () => {
    setMessage(null)
    if (setupPassword !== setupConfirmPassword) {
      setMessage("Admin setup passwords do not match")
      return
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/auth/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: setupName,
            email: setupEmail,
            password: setupPassword,
          }),
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_15%_20%,_#d5f5e3_0,_transparent_45%),radial-gradient(circle_at_85%_10%,_#fef3c7_0,_transparent_40%),linear-gradient(to_bottom,_#f8fafc,_#f3f4f6)]">
      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-14">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            B Ikaze Inventory System
          </p>
          <h1 className="text-3xl font-semibold sm:text-4xl">Sign in to Operations</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Manage store-level products, sales, and inventory from a single hub.
            Admin setup is required only once.
          </p>
        </div>

        {message ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {message}
          </div>
        ) : null}

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-border/80 bg-card/95 p-5 shadow-sm backdrop-blur sm:p-6">
            <div className="mb-3 flex items-center gap-2">
              <KeyRound className="size-4 text-primary" />
              <h2 className="text-lg font-semibold">Login</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Access your assigned stores and daily operations.
            </p>
            <div className="mt-4 space-y-3">
              <Input
                placeholder="Email or username"
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                type="text"
              />
              <Input
                placeholder="Password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                type="password"
              />
              <Button onClick={handleLogin} disabled={isPending}>
                Sign in
              </Button>
            </div>
          </section>

          <section className="rounded-2xl border border-border/80 bg-card/95 p-5 shadow-sm backdrop-blur sm:p-6">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              <h2 className="text-lg font-semibold">Admin Setup</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Create the initial admin account (run once).
            </p>
            <div className="mt-4 space-y-3">
              <Input
                placeholder="Full name"
                value={setupName}
                onChange={(event) => setSetupName(event.target.value)}
              />
              <Input
                placeholder="Admin email"
                value={setupEmail}
                onChange={(event) => setSetupEmail(event.target.value)}
                type="email"
              />
              <Input
                placeholder="Admin password"
                value={setupPassword}
                onChange={(event) => setSetupPassword(event.target.value)}
                type="password"
              />
              <Input
                placeholder="Confirm admin password"
                value={setupConfirmPassword}
                onChange={(event) => setSetupConfirmPassword(event.target.value)}
                type="password"
              />
              <Button variant="secondary" onClick={handleSetup} disabled={isPending}>
                Create admin
              </Button>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
