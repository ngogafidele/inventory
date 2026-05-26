// Maintains the compatibility wrapper for the application sidebar.
import { Sidebar } from "@/components/layout/sidebar"
import type { AuthSession } from "@/lib/auth/session"

export function NavigationSidebar({ session }: { session: AuthSession }) {
  return <Sidebar session={session} />
}
