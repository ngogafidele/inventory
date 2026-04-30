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
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Multi-Store Inventory
            </p>
            <h1 className="text-2xl font-semibold">Operations Hub</h1>
          </div>
          <div className="flex w-full flex-wrap items-center gap-3 md:w-auto md:justify-end">
            <StoreSwitcher
              currentStore={currentStore}
              availableStores={session.stores}
            />
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 md:flex-row">
        <Sidebar />
        <main className="flex-1 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
