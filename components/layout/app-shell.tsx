import type { ReactNode } from "react"
import type { AuthSession } from "@/lib/auth/session"
import { Sidebar } from "@/components/layout/sidebar"
import { StoreSwitcher } from "@/components/store-switcher"
import { LogoutButton } from "@/components/auth/logout-button"

export function AppShell({
  session,
  children,
}: {
  session: AuthSession
  children: ReactNode
}) {
  const currentStore = session.currentStore ?? session.stores[0]

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Multi-Store Inventory
            </p>
            <h1 className="text-2xl font-semibold">Operations Hub</h1>
          </div>
          <div className="flex items-center gap-3">
            <StoreSwitcher
              currentStore={currentStore}
              availableStores={session.stores}
            />
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl gap-6 px-6 py-6">
        <Sidebar />
        <main className="flex-1 rounded-2xl border border-border bg-card p-6 shadow-sm">
          {children}
        </main>
      </div>
    </div>
  )
}
