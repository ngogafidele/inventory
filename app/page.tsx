"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function Home() {
  const router = useRouter()
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [setupName, setSetupName] = useState("")
  const [setupEmail, setSetupEmail] = useState("")
  const [setupPassword, setSetupPassword] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleLogin = () => {
    setMessage(null)
    startTransition(async () => {
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
    })
  }

  const handleSetup = () => {
    setMessage(null)
    startTransition(async () => {
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
    })
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-zinc-50 via-white to-zinc-100">
      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-16">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Multi-Store Inventory System
          </p>
          <h1 className="text-4xl font-semibold">Sign in to Operations</h1>
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

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Login</h2>
            <p className="text-sm text-muted-foreground">
              Access your assigned stores and daily operations.
            </p>
            <div className="mt-4 space-y-3">
              <Input
                placeholder="Email"
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                type="email"
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

          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Admin Setup</h2>
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
