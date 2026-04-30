import type { ReactNode } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { requireServerSession } from "@/lib/auth/server"
import { connectToDatabase } from "@/lib/db/connection"
import { User } from "@/lib/db/models/User"

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const session = await requireServerSession()
  let userName = session.name

  if (!userName) {
    await connectToDatabase()
    const user = await User.findById(session.userId).select("name").lean()
    userName = user?.name
  }

  return (
    <AppShell session={session} userName={userName}>
      {children}
    </AppShell>
  )
}
