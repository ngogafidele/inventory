import type { ReactNode } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { requireServerSession } from "@/lib/auth/server"

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const session = requireServerSession()
  return <AppShell session={session}>{children}</AppShell>
}
