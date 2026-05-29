// Defines the authenticated header, navigation, and content shell.
import type { ReactNode } from "react"
import Image from "next/image"
import type { AuthSession } from "@/lib/auth/session"
import { Sidebar } from "@/components/layout/sidebar"
import { LoanNotifications } from "@/components/layout/loan-notifications"
import { StoreSwitcher } from "@/components/store-switcher"
import { LogoutButton } from "@/components/auth/logout-button"
import { UserRound } from "lucide-react"

export function AppShell({
  session,
  userName,
  children,
}: {
  session: AuthSession
  userName?: string
  children: ReactNode
}) {
  const currentStore = session.currentStore ?? session.stores[0]
  const displayName = userName ?? session.name ?? session.email

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-[92rem] flex-col gap-3 px-2 py-2 sm:px-3 sm:py-3 lg:px-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-white shadow-sm">
              <Image
                src="/images/logo.png"
                alt="B Ikaze Inventory logo"
                width={48}
                height={48}
                priority
                className="h-full w-full object-contain p-1.5"
              />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                B Ikaze Inventory
              </p>
              <h1 className="text-xl font-semibold sm:text-2xl">
                Operations Hub
              </h1>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center gap-3 md:w-auto md:justify-end">
            <LoanNotifications />
            <div className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-background px-3 py-2 shadow-sm">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UserRound className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {displayName}
                </p>
                <p className="truncate text-xs capitalize text-muted-foreground">
                  {session.role} - {session.email}
                </p>
              </div>
            </div>
            {session.isAdmin ? (
              <StoreSwitcher
                currentStore={currentStore}
                availableStores={session.stores}
                isAdmin={session.isAdmin}
              />
            ) : null}
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-[92rem] flex-col gap-3 px-2 py-2 sm:px-3 sm:py-3 lg:px-4 md:flex-row">
        <Sidebar session={session} />
        <main className="flex-1 rounded-2xl border border-border/80 bg-card/95 p-2 shadow-sm backdrop-blur-sm sm:p-3 lg:p-4">
          {children}
        </main>
      </div>
    </div>
  )
}
